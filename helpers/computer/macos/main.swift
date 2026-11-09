import AppKit
import ApplicationServices
import Carbon
import ScreenCaptureKit

// Only the parent process's stdin is a command channel. No shell or URL execution.
struct HelperError: Error {
    let message: String
    init(_ code: String, _ message: String) { self.message = "\(code): \(message)" }
}

func secureField(role: String, subrole: String, secureInput: Bool) -> Bool {
    secureInput || role == "AXSecureTextField" || subrole == "AXSecureTextField"
}
func permitsSecureKey(_ keys: [String]) -> Bool {
    keys.count == 1 && ["enter", "tab", "escape"].contains(keys[0])
}
func emit(_ value: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) else { return }
    FileHandle.standardOutput.write(data + Data([10]))
}
func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}
func elementAttribute(_ element: AXUIElement, _ name: String) -> AXUIElement? {
    guard let value = attribute(element, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return (value as! AXUIElement)
}
func isSecure(_ element: AXUIElement) -> Bool {
    secureField(role: attribute(element, kAXRoleAttribute) as? String ?? "",
                subrole: attribute(element, kAXSubroleAttribute) as? String ?? "", secureInput: IsSecureEventInputEnabled())
}
func appInfo(_ app: NSRunningApplication) -> [String: Any] {
    ["id": app.bundleIdentifier ?? "", "name": app.localizedName ?? "", "pid": Int(app.processIdentifier)]
}
func number(_ request: [String: Any], _ key: String, default fallback: Double? = nil) throws -> Double {
    if request[key] == nil, let fallback { return fallback }
    guard let value = request[key] as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(), value.doubleValue.isFinite else {
        throw HelperError("invalid_params", "\(key) 값이 올바르지 않습니다.")
    }
    return value.doubleValue
}
func integer(_ request: [String: Any], _ key: String, default fallback: Int, range: ClosedRange<Int>) throws -> Int {
    let value = try number(request, key, default: Double(fallback))
    guard value.rounded() == value, value >= Double(range.lowerBound), value <= Double(range.upperBound) else {
        throw HelperError("invalid_params", "\(key) 값이 허용 범위를 벗어났습니다.")
    }
    return Int(value)
}
func allowList(_ request: [String: Any]) throws -> Set<String> {
    guard let apps = request["apps"] as? [String], !apps.isEmpty else { throw HelperError("not_allowed", "허용된 앱이 없습니다.") }
    guard apps.count <= 256, apps.allSatisfy({ !$0.isEmpty && $0.utf8.count <= 255 }) else { throw HelperError("invalid_params", "앱 허용 목록이 올바르지 않습니다.") }
    return Set(apps)
}
func requireAllowed(_ app: NSRunningApplication?, _ allowed: Set<String>) throws -> NSRunningApplication {
    guard let app, let id = app.bundleIdentifier, allowed.contains(id), !app.isTerminated else {
        throw HelperError("not_allowed", "허용되지 않은 앱입니다: \(app?.localizedName ?? "알 수 없음")")
    }
    return app
}
func requirePermission(_ granted: Bool, _ name: String) throws {
    guard granted else { throw HelperError("permission_denied", "시스템 설정에서 \(name)을 허용하세요.") }
}
func requireAccessibility() throws {
    try requirePermission(AXIsProcessTrusted(), "손쉬운 사용")
}

@MainActor
final class ComputerHelper: NSObject {
    private var panel: NSPanel?
    private var stopped = false
    private let source = CGEventSource(stateID: .privateState)
    private let captureBackground = CGColor(gray: 0, alpha: 1)
    private let keyCodes: [String: CGKeyCode] = [
        "a":0,"s":1,"d":2,"f":3,"h":4,"g":5,"z":6,"x":7,"c":8,"v":9,"b":11,
        "q":12,"w":13,"e":14,"r":15,"y":16,"t":17,"1":18,"2":19,"3":20,"4":21,"6":22,"5":23,
        "9":25,"7":26,"8":28,"0":29,"o":31,"u":32,"i":34,"p":35,"enter":36,"l":37,"j":38,"k":40,
        "n":45,"m":46,"tab":48,"space":49,"backspace":51,"escape":53,"f1":122,"f2":120,"f3":99,
        "f4":118,"f5":96,"f6":97,"f7":98,"f8":100,"f9":101,"f10":109,"f11":103,"f12":111,
        "home":115,"end":119,"pageup":116,"pagedown":121,"delete":117,"left":123,"right":124,"down":125,"up":126
    ]
    private func runningApp(_ id: String) -> NSRunningApplication? {
        NSWorkspace.shared.runningApplications.first { $0.bundleIdentifier == id && !$0.isTerminated }
    }
    private func focusedElement(_ app: NSRunningApplication) -> AXUIElement? {
        let root = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(root, 0.5)
        return elementAttribute(root, kAXFocusedUIElementAttribute)
    }
    private func inputTarget(_ allowed: Set<String>, keyboard: Bool = false, keys: [String]? = nil) throws -> NSRunningApplication {
        guard !stopped else { throw HelperError("stopped", "사용자가 컴퓨터 제어를 중지했습니다.") }
        let app = try requireAllowed(NSWorkspace.shared.frontmostApplication, allowed)
        try requireAccessibility()
        if keyboard {
            guard let element = focusedElement(app) else { throw HelperError("focus_unavailable", "입력 대상의 보안 상태를 확인할 수 없습니다.") }
            if isSecure(element), keys.map(permitsSecureKey) != true { throw HelperError("secure_field", "보안 입력 필드에는 입력할 수 없습니다.") }
        }
        return app
    }
    private func pointerTarget(_ point: CGPoint, _ allowed: Set<String>) throws -> NSRunningApplication {
        let app = try inputTarget(allowed)
        var element: AXUIElement?
        guard AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(), Float(point.x), Float(point.y), &element) == .success,
              let element else { throw HelperError("target_unavailable", "포인터 대상 앱을 확인할 수 없습니다.") }
        var pid: pid_t = 0
        guard AXUIElementGetPid(element, &pid) == .success, pid == app.processIdentifier else {
            throw HelperError("not_allowed", "현재 허용된 앱의 영역에서만 입력할 수 있습니다.")
        }
        return app
    }
    private func point(_ request: [String: Any]) throws -> CGPoint {
        let x = try number(request, "x"), y = try number(request, "y")
        guard abs(x) <= 100_000, abs(y) <= 100_000 else { throw HelperError("invalid_params", "화면 좌표가 올바르지 않습니다.") }
        return CGPoint(x: x, y: y)
    }
    @objc private func stopPressed() {
        stopped = true
        panel?.orderOut(nil)
        emit(["event": "stop"])
    }
    private func indicator(_ request: [String: Any]) throws {
        guard let on = request["on"] as? Bool else { throw HelperError("invalid_params", "on 값이 필요합니다.") }
        if !on { panel?.orderOut(nil); return }
        stopped = false
        if panel == nil {
            let label = NSTextField(labelWithString: "Heisen 제어 중 · ⌘⇧Esc 중지")
            let button = NSButton(title: "중지", target: self, action: #selector(stopPressed))
            let stack = NSStackView(views: [label, button])
            stack.orientation = .horizontal
            stack.edgeInsets = NSEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
            let size = stack.fittingSize
            stack.frame = NSRect(origin: .zero, size: size)
            let window = NSPanel(contentRect: stack.frame, styleMask: [.nonactivatingPanel, .titled], backing: .buffered, defer: false)
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.level = .statusBar
            window.hidesOnDeactivate = false
            window.isReleasedWhenClosed = false
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            window.contentView = stack
            panel = window
        }
        if let panel, let screen = NSScreen.main ?? NSScreen.screens.first {
            panel.setFrameTopLeftPoint(NSPoint(x: screen.visibleFrame.maxX - panel.frame.width - 12, y: screen.visibleFrame.maxY - 12))
            panel.orderFrontRegardless()
        }
    }
    private func tree(_ app: NSRunningApplication, depth: Int, maxNodes: Int) -> [String: Any] {
        let root = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(root, 0.2)
        var count = 0
        let deadline = Date().addingTimeInterval(8)
        var seen = Set<AXUIElement>()
        func walk(_ element: AXUIElement, _ level: Int) -> [String: Any]? {
            guard count < maxNodes, Date() < deadline, !seen.contains(element) else { return nil }
            seen.insert(element)
            count += 1
            let id = count, secure = isSecure(element)
            var position = CGPoint.zero, size = CGSize.zero
            if let value = attribute(element, kAXPositionAttribute), CFGetTypeID(value) == AXValueGetTypeID() {
                AXValueGetValue(value as! AXValue, .cgPoint, &position)
            }
            if let value = attribute(element, kAXSizeAttribute), CFGetTypeID(value) == AXValueGetTypeID() {
                AXValueGetValue(value as! AXValue, .cgSize, &size)
            }
            var node: [String: Any] = ["id": String(id), "role": attribute(element, kAXRoleAttribute) as? String ?? "",
                "title": secure ? "" : String((attribute(element, kAXTitleAttribute) as? String ?? "").prefix(2000)),
                "frame": ["x": position.x, "y": position.y, "w": size.width, "h": size.height],
                "enabled": attribute(element, kAXEnabledAttribute) as? Bool ?? false,
                "focused": attribute(element, kAXFocusedAttribute) as? Bool ?? false]
            if !secure, let value = attribute(element, kAXValueAttribute) {
                if let text = value as? String { node["value"] = String(text.prefix(4000)) }
                else if let number = value as? NSNumber { node["value"] = number }
            }
            var children: [[String: Any]] = []
            if !secure, level < depth, let items = attribute(element, kAXChildrenAttribute) as? [AXUIElement] {
                for child in items {
                    guard count < maxNodes, Date() < deadline else { break }
                    if let node = walk(child, level + 1) { children.append(node) }
                }
            }
            node["children"] = children
            return node
        }
        return ["app": appInfo(app), "nodes": walk(root, 0).map { [$0] } ?? []]
    }
    @available(macOS 14.0, *)
    private func screenshot(_ allowed: Set<String>, maxWidth: Int) async throws -> [String: Any] {
        try requirePermission(CGPreflightScreenCaptureAccess(), "화면 기록")
        let content = try await SCShareableContent.current
        let windows = content.windows.filter { $0.isOnScreen && $0.windowLayer == 0 && allowed.contains($0.owningApplication?.bundleIdentifier ?? "") }
        let displays = content.displays.filter { display in windows.contains { $0.frame.intersects(display.frame) } }
        guard !windows.isEmpty, !displays.isEmpty else { throw HelperError("no_windows", "허용된 앱의 화면에 보이는 창이 없습니다.") }
        let bounds = displays.reduce(CGRect.null) { $0.union($1.frame) }
        let scale = min(1, Double(maxWidth) / bounds.width)
        let width = max(1, Int(ceil(bounds.width * scale))), height = max(1, Int(ceil(bounds.height * scale)))
        guard height <= 16_384, let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
            throw HelperError("capture_failed", "화면 이미지 크기가 너무 큽니다.")
        }
        context.setFillColor(CGColor(gray: 0, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        for display in displays {
            guard !stopped else { throw HelperError("stopped", "사용자가 컴퓨터 제어를 중지했습니다.") }
            let filter = SCContentFilter(display: display, including: windows.filter { $0.frame.intersects(display.frame) })
            if #available(macOS 14.2, *) { filter.includeMenuBar = false }
            let config = SCStreamConfiguration()
            config.width = max(1, Int(ceil(display.frame.width * scale)))
            config.height = max(1, Int(ceil(display.frame.height * scale)))
            config.showsCursor = false
            config.ignoreShadowsDisplay = true
            config.backgroundColor = captureBackground
            let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
            context.draw(image, in: CGRect(x: (display.frame.minX - bounds.minX) * scale,
                y: Double(height) - (display.frame.maxY - bounds.minY) * scale,
                width: display.frame.width * scale, height: display.frame.height * scale))
        }
        guard !stopped, let image = context.makeImage(), let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
            throw HelperError("capture_failed", "화면 이미지를 만들 수 없습니다.")
        }
        return ["png": png.base64EncodedString(), "width": width, "height": height, "scale": scale,
                "origin": ["x": bounds.minX, "y": bounds.minY]]
    }
    func handle(_ request: [String: Any]) async throws -> Any {
        guard let op = request["op"] as? String else { throw HelperError("invalid_request", "op 값이 필요합니다.") }
        if op == "quit" { return ["ok": true] }
        guard #available(macOS 14.0, *) else { throw HelperError("unsupported_os", "컴퓨터 제어는 macOS 14 이상에서 사용할 수 있습니다.") }
        switch op {
        case "permissions": return ["screen": CGPreflightScreenCaptureAccess(), "accessibility": AXIsProcessTrusted()]
        case "request_permission":
            switch request["kind"] as? String {
            case "screen": _ = CGRequestScreenCaptureAccess()
            case "accessibility": _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary)
            default: throw HelperError("invalid_params", "권한 종류가 올바르지 않습니다.")
            }
            return ["requested": true]
        case "apps": return NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular && $0.bundleIdentifier != nil }.map {
            appInfo($0).merging(["active": $0.isActive]) { _, new in new }
        }
        case "focused":
            guard let app = NSWorkspace.shared.frontmostApplication else { throw HelperError("focus_unavailable", "활성 앱이 없습니다.") }
            let element = AXIsProcessTrusted() ? focusedElement(app) : nil
            return ["app": appInfo(app), "element": ["role": element.flatMap { attribute($0, kAXRoleAttribute) as? String } ?? "",
                                                      "secure": element.map(isSecure) ?? true]]
        case "indicator": try indicator(request); return ["ok": true]
        case "screenshot", "ui_tree", "activate", "click", "type", "key", "scroll": break
        default: throw HelperError("unknown_op", "지원하지 않는 명령입니다.")
        }
        let allowed = try allowList(request)
        guard !stopped else { throw HelperError("stopped", "사용자가 컴퓨터 제어를 중지했습니다.") }
        switch op {
        case "screenshot": return try await screenshot(allowed, maxWidth: integer(request, "maxWidth", default: 1280, range: 1...1280))
        case "ui_tree":
            let app = try requireAllowed((request["app"] as? String).flatMap(runningApp) ?? (request["app"] == nil ? NSWorkspace.shared.frontmostApplication : nil), allowed)
            try requireAccessibility()
            return try tree(app, depth: integer(request, "depth", default: 6, range: 0...20), maxNodes: integer(request, "maxNodes", default: 400, range: 1...400))
        case "activate":
            guard let id = request["app"] as? String else { throw HelperError("invalid_params", "app 값이 필요합니다.") }
            let app = try requireAllowed(runningApp(id), allowed)
            try requireAccessibility()
            guard app.activate(options: [.activateIgnoringOtherApps]) else { throw HelperError("activate_failed", "앱을 활성화할 수 없습니다.") }
        case "click":
            let point = try point(request)
            let buttonName = request["button"] as? String ?? "left"
            guard ["left", "right"].contains(buttonName) else { throw HelperError("invalid_params", "마우스 버튼이 올바르지 않습니다.") }
            let count = try integer(request, "count", default: 1, range: 1...2)
            let button: CGMouseButton = buttonName == "left" ? .left : .right
            for click in 1...count {
                let app = try pointerTarget(point, allowed)
                guard let down = CGEvent(mouseEventSource: source, mouseType: button == .left ? .leftMouseDown : .rightMouseDown, mouseCursorPosition: point, mouseButton: button),
                      let up = CGEvent(mouseEventSource: source, mouseType: button == .left ? .leftMouseUp : .rightMouseUp, mouseCursorPosition: point, mouseButton: button) else {
                    throw HelperError("input_failed", "마우스 입력을 만들 수 없습니다.")
                }
                down.setIntegerValueField(.mouseEventClickState, value: Int64(click))
                up.setIntegerValueField(.mouseEventClickState, value: Int64(click))
                down.postToPid(app.processIdentifier); up.postToPid(app.processIdentifier)
            }
        case "type":
            guard let text = request["text"] as? String, text.utf16.count <= 10_000 else { throw HelperError("invalid_params", "입력 문자열이 없거나 너무 깁니다.") }
            _ = try inputTarget(allowed, keyboard: true)
            let units = Array(text.utf16)
            var cursor = 0
            while cursor < units.count {
                var end = min(cursor + 20, units.count)
                // CGEvent chunks must not split a UTF-16 surrogate pair.
                if end < units.count, (0xDC00...0xDFFF).contains(units[end]) { end -= 1 }
                let app = try inputTarget(allowed, keyboard: true)
                guard let down = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true), let up = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false) else {
                    throw HelperError("input_failed", "키보드 입력을 만들 수 없습니다.")
                }
                units.withUnsafeBufferPointer { buffer in
                    down.keyboardSetUnicodeString(stringLength: end - cursor, unicodeString: buffer.baseAddress! + cursor)
                    up.keyboardSetUnicodeString(stringLength: end - cursor, unicodeString: buffer.baseAddress! + cursor)
                }
                down.postToPid(app.processIdentifier); up.postToPid(app.processIdentifier)
                let characters = units[cursor..<end].reduce(0) { $0 + ((0xDC00...0xDFFF).contains($1) ? 0 : 1) }
                cursor = end
                try await Task.sleep(nanoseconds: UInt64(characters) * 12_000_000)
            }
        case "key":
            guard let rawKeys = request["keys"] as? [String], !rawKeys.isEmpty, rawKeys.count <= 5 else { throw HelperError("invalid_params", "키 조합이 올바르지 않습니다.") }
            let keys = rawKeys.map { $0.lowercased() }
            let modifiers: [String: CGEventFlags] = ["cmd": .maskCommand, "win": .maskCommand, "ctrl": .maskControl, "alt": .maskAlternate, "shift": .maskShift]
            let ordinary = keys.filter { modifiers[$0] == nil }
            guard ordinary.count == 1, let key = ordinary.first, let code = keyCodes[key], Set(keys).count == keys.count else {
                throw HelperError("invalid_params", "지원하지 않는 키 조합입니다.")
            }
            let app = try inputTarget(allowed, keyboard: true, keys: keys)
            guard let down = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true), let up = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false) else {
                throw HelperError("input_failed", "키보드 입력을 만들 수 없습니다.")
            }
            let flags = keys.compactMap { modifiers[$0] }.reduce(CGEventFlags()) { $0.union($1) }
            down.flags = flags; up.flags = flags
            down.postToPid(app.processIdentifier); up.postToPid(app.processIdentifier)
        case "scroll":
            let point = try point(request)
            let dx = try integer(request, "dx", default: 0, range: -100_000...100_000)
            let dy = try integer(request, "dy", default: 0, range: -100_000...100_000)
            let app = try pointerTarget(point, allowed)
            guard let event = CGEvent(scrollWheelEvent2Source: source, units: .pixel, wheelCount: 2, wheel1: Int32(dy), wheel2: Int32(dx), wheel3: 0) else {
                throw HelperError("input_failed", "스크롤 입력을 만들 수 없습니다.")
            }
            event.location = point
            event.postToPid(app.processIdentifier)
        default: break
        }
        return ["ok": true]
    }
}

#if !COMPUTER_HELPER_POLICY_TEST
let application = NSApplication.shared
application.setActivationPolicy(.accessory)
DispatchQueue.main.async {
let helper = ComputerHelper()
DispatchQueue.global(qos: .userInitiated).async {
    // One outstanding request: input cannot queue up behind a stop or capture.
    while let line = readLine() {
        let completed = DispatchSemaphore(value: 0)
        DispatchQueue.main.async {
            Task { @MainActor in
                defer { completed.signal() }
                var id: Any = NSNull()
                do {
                    guard line.utf8.count <= 1_048_576, let data = line.data(using: .utf8),
                          let request = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                          let requestID = request["id"] as? NSNumber, CFGetTypeID(requestID) != CFBooleanGetTypeID(),
                          requestID.doubleValue.isFinite, requestID.doubleValue.rounded() == requestID.doubleValue else {
                        throw HelperError("invalid_request", "올바른 JSON 요청과 숫자 id가 필요합니다.")
                    }
                    id = requestID
                    let result = try await helper.handle(request)
                    emit(["id": id, "ok": true, "result": result])
                    if request["op"] as? String == "quit" { application.terminate(nil) }
                } catch let error as HelperError {
                    emit(["id": id, "ok": false, "error": error.message])
                } catch {
                    emit(["id": id, "ok": false, "error": "operation_failed: 작업을 완료하지 못했습니다. 시스템 설정에서 화면 기록/손쉬운 사용 권한을 확인하세요."])
                }
            }
        }
        completed.wait()
    }
    DispatchQueue.main.async { application.terminate(nil) }
}
}
application.run()
#endif
