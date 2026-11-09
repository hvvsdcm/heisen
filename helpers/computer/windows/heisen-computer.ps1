# Windows PowerShell 5.1; stdin is the only command channel. Never execute request text.
# UTF-8 BOM is intentional: Windows PowerShell otherwise decodes Korean as ANSI.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase,System.Drawing,System.Windows.Forms
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public static class HeisenNative {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mouse; [FieldOffset(0)] public KEYBDINPUT key; }
    [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION data; }
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out RECT rect);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
    delegate bool EnumProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern int GetApplicationUserModelId(IntPtr process, ref uint length, StringBuilder id);
    public static void DpiAware() { try { if(SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch(EntryPointNotFoundException) {} SetProcessDPIAware(); }
    public static int Pid(IntPtr window) { uint pid; GetWindowThreadProcessId(window, out pid); return (int)pid; }
    public static string AppId(IntPtr process) {
        uint length=0; if(GetApplicationUserModelId(process, ref length, null)!=122 || length>1024) return null;
        var id=new StringBuilder((int)length); return GetApplicationUserModelId(process, ref length, id)==0 ? id.ToString() : null;
    }
    public static IntPtr[] Windows() {
        var windows=new List<IntPtr>();
        EnumWindows(delegate(IntPtr window, IntPtr unused) {
            int cloaked; if(IsWindowVisible(window) && !IsIconic(window) && (DwmGetWindowAttribute(window,14,out cloaked,4)!=0 || cloaked==0)) windows.Add(window);
            return true;
        }, IntPtr.Zero);
        return windows.ToArray(); // top to bottom, including unapproved occluders
    }
    static void Send(INPUT[] inputs) {
        if(SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)))!=inputs.Length)
            throw new InvalidOperationException("input_failed: 입력을 전달하지 못했습니다. 관리자 권한 앱과 보안 데스크톱은 제어할 수 없습니다.");
    }
    static INPUT Key(ushort vk, ushort scan, uint flags) {
        var input=new INPUT(); input.type=1; input.data.key.vk=vk; input.data.key.scan=scan; input.data.key.flags=flags; return input;
    }
    public static void Unicode(string text) {
        var inputs=new INPUT[text.Length*2];
        for(int i=0;i<text.Length;i++) { inputs[i*2]=Key(0,text[i],4); inputs[i*2+1]=Key(0,text[i],6); }
        Send(inputs);
    }
    public static void Chord(ushort[] keys) {
        var inputs=new INPUT[keys.Length*2];
        for(int i=0;i<keys.Length;i++) {
            uint extended=(keys[i]>=0x21 && keys[i]<=0x2e) || keys[i]==0x5b ? 1u : 0u;
            inputs[i]=Key(keys[i],0,extended); inputs[inputs.Length-1-i]=Key(keys[i],0,extended|2);
        }
        try { Send(inputs); } catch { // release any injected key after a partial SendInput
            var release=new INPUT[keys.Length]; Array.Copy(inputs,keys.Length,release,0,keys.Length);
            SendInput((uint)release.Length,release,Marshal.SizeOf(typeof(INPUT))); throw;
        }
    }
    public static void Mouse(uint flags, int data) {
        var input=new INPUT(); input.data.mouse.flags=flags; input.data.mouse.mouseData=unchecked((uint)data); Send(new[]{input});
    }
    public static void Click(bool right) {
        var down=new INPUT(); down.data.mouse.flags=right?8u:2u;
        var up=new INPUT(); up.data.mouse.flags=right?16u:4u;
        try { Send(new[]{down,up}); } catch { SendInput(1,new[]{up},Marshal.SizeOf(typeof(INPUT))); throw; }
    }
}
public sealed class HeisenIndicator : Form {
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams { get { var p=base.CreateParams; p.ExStyle|=0x08000080; return p; } }
}
public static class HeisenInput {
    // One request in flight; the reader cannot allocate an unbounded line or request queue.
    public static readonly ConcurrentQueue<string> Queue=new ConcurrentQueue<string>();
    public static readonly AutoResetEvent Completed=new AutoResetEvent(false);
    public static volatile bool Eof;
    public static void Start() {
        var thread=new Thread(delegate() {
            try {
                var reader=Console.In; var line=new StringBuilder(); bool overflow=false;
                while(true) {
                    int next=reader.Read(); if(next<0) { if(line.Length>0 || overflow) { Queue.Enqueue(overflow?"":line.ToString()); Completed.WaitOne(); } break; }
                    if(next==10) { Queue.Enqueue(overflow?"":line.ToString().TrimEnd('\r')); line.Clear(); overflow=false; Completed.WaitOne(); }
                    else if(!overflow) { if(line.Length>=1048576) { overflow=true; line.Clear(); } else line.Append((char)next); }
                }
            } finally { Eof=true; }
        }); thread.IsBackground=true; thread.Start();
    }
}
'@
[HeisenNative]::DpiAware()
$script:stopped = $false
$script:quitting = $false
$script:busy = $false
$script:panel = $null
$script:context = New-Object System.Windows.Forms.ApplicationContext
function Emit($value) { [Console]::WriteLine((ConvertTo-Json -InputObject $value -Depth 100 -Compress)) }
function Fail([string]$code, [string]$message) { throw "$($code): $message" }
function Is-Number($value) {
    return ($value -is [byte] -or $value -is [int16] -or $value -is [int32] -or $value -is [int64] -or $value -is [double] -or $value -is [decimal]) -and -not [double]::IsNaN([double]$value) -and -not [double]::IsInfinity([double]$value)
}
function Number($request, [string]$key, $fallback = $null) {
    $value = $request.$key
    if ($null -eq $value -and -not ($request.PSObject.Properties.Name -contains $key)) { $value = $fallback }
    if (-not (Is-Number $value)) { Fail 'invalid_params' "$key 값이 올바르지 않습니다." }
    return [double]$value
}
function Integer($request, [string]$key, [int]$fallback, [int]$min, [int]$max) {
    $value = Number $request $key $fallback
    if ($value -ne [math]::Truncate($value) -or $value -lt $min -or $value -gt $max) { Fail 'invalid_params' "$key 값이 허용 범위를 벗어났습니다." }
    return [int]$value
}
function Allow-List($request) {
    if ($request.apps -isnot [array] -or $request.apps.Count -eq 0) { Fail 'not_allowed' '허용된 앱이 없습니다.' }
    if ($request.apps.Count -gt 256) { Fail 'invalid_params' '앱 허용 목록이 올바르지 않습니다.' }
    foreach ($entry in $request.apps) {
        if ($entry -isnot [string] -or $entry.Length -eq 0 -or [Text.Encoding]::UTF8.GetByteCount($entry) -gt 255) { Fail 'invalid_params' '앱 허용 목록이 올바르지 않습니다.' }
    }
    return ,$request.apps
}
function App-Info([int]$processId) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $null }
    try {
        $id = $null
        try { $id = [HeisenNative]::AppId($process.Handle) } catch { }
        # Generic UWP frame hosts are not an app identity; never allow their shared process name.
        if (-not $id -and $process.ProcessName -eq 'ApplicationFrameHost') { return $null }
        if (-not $id) { $id = $process.ProcessName }
        return @{ id=$id; name=$process.ProcessName; pid=$processId }
    } finally { $process.Dispose() }
}
function Allowed($app, $apps) { return $null -ne $app -and $apps -icontains $app.id }
function Require-Allowed($app, $apps) {
    if (-not (Allowed $app $apps)) { Fail 'not_allowed' '허용되지 않은 앱입니다.' }
    return $app
}
function Require-Running {
    if ($script:stopped) { Fail 'stopped' '사용자가 컴퓨터 제어를 중지했습니다.' }
}
function Focused-App { return App-Info ([HeisenNative]::Pid([HeisenNative]::GetForegroundWindow())) }
function Input-Target($apps, [bool]$keyboard = $false, $keys = @()) {
    Require-Running
    $app = Require-Allowed (Focused-App) $apps
    if ($keyboard) {
        try { $element = [System.Windows.Automation.AutomationElement]::FocusedElement; $current = $element.Current }
        catch { Fail 'focus_unavailable' '입력 대상의 보안 상태를 확인할 수 없습니다.' }
        if ($null -eq $element -or $current.ProcessId -ne $app.pid) { Fail 'focus_unavailable' '입력 대상의 보안 상태를 확인할 수 없습니다.' }
        if ($current.IsPassword -and -not ($keys.Count -eq 1 -and $keys[0] -in @('enter','tab','escape'))) { Fail 'secure_field' '보안 입력 필드에는 입력할 수 없습니다.' }
        # Do not combine injected input with a user's held modifier or mouse drag.
        foreach ($key in @(0x10,0x11,0x12,0x5b,0x5c,1,2,4)) {
            if ([HeisenNative]::GetAsyncKeyState($key) -lt 0) { Fail 'input_busy' '사용자 입력이 끝난 뒤 다시 시도하세요.' }
        }
    }
    return $app
}
function Point($request) {
    $x = Number $request 'x'; $y = Number $request 'y'
    if ([math]::Abs($x) -gt 100000 -or [math]::Abs($y) -gt 100000) { Fail 'invalid_params' '화면 좌표가 올바르지 않습니다.' }
    return New-Object System.Drawing.Point([int][math]::Round($x), [int][math]::Round($y))
}
function Pointer-Target($point, $apps) {
    $app = Input-Target $apps
    $nativePoint = New-Object HeisenNative+POINT; $nativePoint.X=$point.X; $nativePoint.Y=$point.Y
    if ([HeisenNative]::Pid([HeisenNative]::WindowFromPoint($nativePoint)) -ne $app.pid) { Fail 'not_allowed' '현재 허용된 앱의 영역에서만 입력할 수 있습니다.' }
    try { $element = [System.Windows.Automation.AutomationElement]::FromPoint((New-Object System.Windows.Point($point.X,$point.Y))) }
    catch { Fail 'target_unavailable' '포인터 대상 앱을 확인할 수 없습니다.' }
    if ($null -eq $element -or $element.Current.ProcessId -ne $app.pid) { Fail 'not_allowed' '현재 허용된 앱의 영역에서만 입력할 수 있습니다.' }
    return $app
}
function Find-AppWindow([string]$id) {
    foreach ($window in [HeisenNative]::Windows()) {
        $app = App-Info ([HeisenNative]::Pid($window))
        if ($app -and $app.id -ieq $id) { return @{ app=$app; window=$window } }
    }
    # Minimized apps are absent from the capture inventory but can still be activated.
    foreach ($process in Get-Process) {
        try {
            if ($process.MainWindowHandle -eq [IntPtr]::Zero) { continue }
            $app=App-Info $process.Id
            if ($app -and $app.id -ieq $id) { return @{app=$app;window=$process.MainWindowHandle} }
        } finally { $process.Dispose() }
    }
    return $null
}
function Stop-Control {
    $script:stopped=$true
    if ($script:panel) { $script:panel.Hide() }
    Emit @{event='stop'}
}
function Indicator($request) {
    if ($request.on -isnot [bool]) { Fail 'invalid_params' 'on 값이 필요합니다.' }
    if (-not $request.on) { if ($script:panel) { $script:panel.Hide() }; return }
    if (-not [Environment]::UserInteractive -or [HeisenNative]::GetForegroundWindow() -eq [IntPtr]::Zero) { Fail 'desktop_unavailable' '대화형 Windows 데스크톱에서 실행하세요.' }
    $script:stopped=$false
    if (-not $script:panel) {
        $script:panel=New-Object HeisenIndicator
        $script:panel.Text='Heisen 제어 중 · Ctrl+Shift+Esc 중지'
        $script:panel.TopMost=$true; $script:panel.ShowInTaskbar=$false
        $script:panel.FormBorderStyle='FixedToolWindow'; $script:panel.StartPosition='Manual'
        $script:panel.AutoSize=$true; $script:panel.AutoSizeMode='GrowAndShrink'
        $row=New-Object System.Windows.Forms.FlowLayoutPanel; $row.AutoSize=$true; $row.Dock='Fill'
        $label=New-Object System.Windows.Forms.Label; $label.Text=$script:panel.Text; $label.AutoSize=$true
        $button=New-Object System.Windows.Forms.Button; $button.Text='중지'; $button.AutoSize=$true
        $button.Add_Click({ Stop-Control })
        $row.Controls.Add($label); $row.Controls.Add($button); $script:panel.Controls.Add($row)
        $script:panel.Add_FormClosing({ param($sender,$eventArgs) if (-not $script:quitting) { $eventArgs.Cancel=$true; Stop-Control } })
    }
    $script:panel.Show()
    $area=[System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $script:panel.Location=New-Object System.Drawing.Point(($area.Right-$script:panel.Width-12),($area.Top+12))
}
function Tree($app, [IntPtr]$window, [int]$depth, [int]$maxNodes) {
    $state=@{count=0; deadline=[DateTime]::UtcNow.AddSeconds(8); seen=New-Object 'System.Collections.Generic.HashSet[string]'}
    function Walk($element, [int]$level) {
        if ($state.count -ge $maxNodes -or [DateTime]::UtcNow -ge $state.deadline) { return $null }
        $current=$element.Current
        if ($current.ProcessId -ne $app.pid) { return $null }
        $runtimeId=$element.GetRuntimeId() -join '.'
        if (-not $state.seen.Add($runtimeId)) { return $null }
        $state.count++
        $secure=$current.IsPassword; $rect=$current.BoundingRectangle
        $node=@{id=[string]$state.count; role=$current.ControlType.ProgrammaticName; title=''; frame=@{x=0;y=0;w=0;h=0}; enabled=$current.IsEnabled; focused=$current.HasKeyboardFocus; children=@()}
        if (-not $rect.IsEmpty) { $node.frame=@{x=$rect.X;y=$rect.Y;w=$rect.Width;h=$rect.Height} }
        if (-not $secure) {
            $node.title=$current.Name.Substring(0,[math]::Min(2000,$current.Name.Length))
            $pattern=$null
            if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern)) {
                $value=$pattern.Current.Value
                $node.value=$value.Substring(0,[math]::Min(4000,$value.Length))
            }
            if ($level -lt $depth) {
                $walker=[System.Windows.Automation.TreeWalker]::ControlViewWalker
                $child=$walker.GetFirstChild($element)
                $children=New-Object 'System.Collections.Generic.List[object]'
                while ($child -and $state.count -lt $maxNodes -and [DateTime]::UtcNow -lt $state.deadline) {
                    $childNode=Walk $child ($level+1)
                    if ($childNode) { $children.Add($childNode) }
                    $child=$walker.GetNextSibling($child)
                }
                $node.children=$children.ToArray()
            }
        }
        return $node
    }
    $root=[System.Windows.Automation.AutomationElement]::FromHandle($window)
    if ($null -eq $root) { Fail 'target_unavailable' '앱의 접근성 트리를 읽을 수 없습니다.' }
    $node=Walk $root 0
    return @{app=$app; nodes=@($node | Where-Object { $null -ne $_ })}
}
function Window-Snapshot {
    $rows=New-Object 'System.Collections.Generic.List[object]'
    foreach ($window in [HeisenNative]::Windows()) {
        $rect=New-Object HeisenNative+RECT
        if (-not [HeisenNative]::GetWindowRect($window,[ref]$rect)) { Fail 'capture_failed' '창 영역을 확인할 수 없습니다.' }
        if ($rect.Right -le $rect.Left -or $rect.Bottom -le $rect.Top) { continue }
        $rows.Add(@{window=$window.ToInt64(); pid=[HeisenNative]::Pid($window); x=$rect.Left; y=$rect.Top; w=$rect.Right-$rect.Left; h=$rect.Bottom-$rect.Top})
    }
    return ,$rows.ToArray()
}
function Screenshot($apps, [int]$maxWidth) {
    Require-Running
    $windows=Window-Snapshot
    $bounds=[System.Windows.Forms.SystemInformation]::VirtualScreen
    if ($bounds.Width -le 0 -or $bounds.Height -le 0 -or $bounds.Width -gt 32768 -or $bounds.Height -gt 16384) { Fail 'capture_failed' '화면 이미지 크기가 올바르지 않습니다.' }
    $scale=[math]::Min(1,$maxWidth/[double]$bounds.Width)
    $width=[int][math]::Ceiling($bounds.Width*$scale); $height=[int][math]::Ceiling($bounds.Height*$scale)
    $output=New-Object System.Drawing.Bitmap($width,$height)
    $graphics=[System.Drawing.Graphics]::FromImage($output)
    $covered=New-Object System.Drawing.Region; $covered.MakeEmpty()
    $found=$false
    try {
        $graphics.Clear([System.Drawing.Color]::Black)
        # Interpolation must not blend an excluded window's adjacent pixels into the mask.
        $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        foreach ($row in $windows) {
            Require-Running
            $rect=[System.Drawing.Rectangle]::Intersect($bounds,(New-Object System.Drawing.Rectangle($row.x,$row.y,$row.w,$row.h)))
            if ($rect.IsEmpty) { continue }
            $visible=New-Object System.Drawing.Region($rect)
            try {
                $visible.Exclude($covered)
                $covered.Union($rect) # Subtract EVERY higher window, including unapproved/transparent overlays.
                if (-not (Allowed (App-Info $row.pid) $apps)) { continue }
                $found=$true
                $image=New-Object System.Drawing.Bitmap($rect.Width,$rect.Height)
                $capture=[System.Drawing.Graphics]::FromImage($image)
                $transform=New-Object System.Drawing.Drawing2D.Matrix
                try {
                    $capture.CopyFromScreen($rect.Location,[System.Drawing.Point]::Empty,$rect.Size)
                    $transform.Translate(-$bounds.X,-$bounds.Y)
                    $transform.Scale([single]$scale,[single]$scale,[System.Drawing.Drawing2D.MatrixOrder]::Append)
                    $visible.Transform($transform)
                    $graphics.SetClip($visible,[System.Drawing.Drawing2D.CombineMode]::Replace)
                    $destination=New-Object System.Drawing.RectangleF([single](($rect.X-$bounds.X)*$scale),[single](($rect.Y-$bounds.Y)*$scale),[single]($rect.Width*$scale),[single]($rect.Height*$scale))
                    $graphics.DrawImage($image,$destination)
                } finally { $transform.Dispose(); $capture.Dispose(); $image.Dispose() }
            } finally { $visible.Dispose() }
        }
        if (-not $found) { Fail 'no_windows' '허용된 앱의 화면에 보이는 창이 없습니다.' }
        # Never publish a capture whose allow-list masking used stale z-order/geometry.
        if ((ConvertTo-Json -InputObject $windows -Compress) -cne (ConvertTo-Json -InputObject (Window-Snapshot) -Compress)) { Fail 'capture_changed' '창 배치가 변경되었습니다. 다시 캡처하세요.' }
        Require-Running
        $stream=New-Object System.IO.MemoryStream
        try {
            $output.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
            return @{png=[Convert]::ToBase64String($stream.ToArray()); width=$width; height=$height; scale=$scale; origin=@{x=$bounds.X;y=$bounds.Y}}
        } finally { $stream.Dispose() }
    } finally { $covered.Dispose(); $graphics.Dispose(); $output.Dispose() }
}
function Handle($request) {
    if ($request.op -isnot [string]) { Fail 'invalid_request' 'op 값이 필요합니다.' }
    switch -CaseSensitive ($request.op) {
        'quit' { $script:quitting=$true; return @{ok=$true} }
        'permissions' { return @{screen=$true;accessibility=$true} }
        'request_permission' {
            if ($request.kind -cnotin @('screen','accessibility')) { Fail 'invalid_params' '권한 종류가 올바르지 않습니다.' }
            return @{requested=$true}
        }
        'apps' {
            $active=[HeisenNative]::Pid([HeisenNative]::GetForegroundWindow())
            $apps=New-Object 'System.Collections.Generic.List[object]'
            foreach ($process in Get-Process) {
                try { if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
                    $app=App-Info $process.Id
                    if ($app) { $app.active=$process.Id -eq $active; $apps.Add($app) }
                } } finally { $process.Dispose() }
            }
            return ,$apps.ToArray()
        }
        'focused' {
            $app=Focused-App
            if (-not $app) { Fail 'focus_unavailable' '활성 앱이 없습니다.' }
            $role=''; $secure=$true
            try {
                $element=[System.Windows.Automation.AutomationElement]::FocusedElement
                if ($element -and $element.Current.ProcessId -eq $app.pid) { $role=$element.Current.ControlType.ProgrammaticName; $secure=$element.Current.IsPassword }
            } catch { }
            return @{app=$app;element=@{role=$role;secure=$secure}}
        }
        'indicator' { Indicator $request; return @{ok=$true} }
        { $_ -cin @('screenshot','ui_tree','activate','click','type','key','scroll') } { break }
        default { Fail 'unknown_op' '지원하지 않는 명령입니다.' }
    }
    $apps=Allow-List $request
    Require-Running
    switch -CaseSensitive ($request.op) {
        'screenshot' { return Screenshot $apps (Integer $request 'maxWidth' 1280 1 1280) }
        'ui_tree' {
            $selected=if ($request.PSObject.Properties.Name -contains 'app') {
                if ($request.app -isnot [string]) { Fail 'invalid_params' 'app 값이 필요합니다.' }
                Find-AppWindow $request.app
            } else { @{app=(Focused-App);window=[HeisenNative]::GetForegroundWindow()} }
            $app=Require-Allowed $selected.app $apps
            return Tree $app $selected.window (Integer $request 'depth' 6 0 20) (Integer $request 'maxNodes' 400 1 400)
        }
        'activate' {
            if ($request.app -isnot [string]) { Fail 'invalid_params' 'app 값이 필요합니다.' }
            $selected=Find-AppWindow $request.app
            $null=Require-Allowed $selected.app $apps
            [void][HeisenNative]::ShowWindow($selected.window,9)
            if (-not [HeisenNative]::SetForegroundWindow($selected.window)) { Fail 'activate_failed' '앱을 활성화할 수 없습니다.' }
        }
        'click' {
            $point=Point $request
            $button=if ($null -eq $request.button) {'left'} else {$request.button}
            if ($button -cnotin @('left','right')) { Fail 'invalid_params' '마우스 버튼이 올바르지 않습니다.' }
            $count=Integer $request 'count' 1 1 2
            for ($i=0;$i -lt $count;$i++) {
                $null=Pointer-Target $point $apps
                if (-not [HeisenNative]::SetCursorPos($point.X,$point.Y)) { Fail 'input_failed' '포인터를 이동할 수 없습니다.' }
                $null=Pointer-Target $point $apps
                [HeisenNative]::Click($button -eq 'right')
            }
        }
        'type' {
            if ($request.text -isnot [string] -or $request.text.Length -gt 10000) { Fail 'invalid_params' '입력 문자열이 없거나 너무 깁니다.' }
            $null=Input-Target $apps $true
            for ($i=0;$i -lt $request.text.Length;) {
                [System.Windows.Forms.Application]::DoEvents()
                $null=Input-Target $apps $true
                $length=1
                if ([char]::IsHighSurrogate($request.text[$i]) -and $i+1 -lt $request.text.Length -and [char]::IsLowSurrogate($request.text[$i+1])) { $length=2 }
                [HeisenNative]::Unicode($request.text.Substring($i,$length)); $i+=$length
                Start-Sleep -Milliseconds 12
            }
        }
        'key' {
            if ($request.keys -isnot [array] -or $request.keys.Count -eq 0 -or $request.keys.Count -gt 5) { Fail 'invalid_params' '키 조합이 올바르지 않습니다.' }
            $keys=@(foreach ($key in $request.keys) {
                if ($key -isnot [string]) { Fail 'invalid_params' '키 조합이 올바르지 않습니다.' }
                $key.ToLowerInvariant()
            })
            $modifiers=@{cmd=0x5b;win=0x5b;ctrl=0x11;alt=0x12;shift=0x10}
            $codes=@{enter=13;tab=9;escape=27;space=32;backspace=8;delete=46;up=38;down=40;left=37;right=39;home=36;end=35;pageup=33;pagedown=34}
            foreach ($c in [char[]]'abcdefghijklmnopqrstuvwxyz0123456789') { $codes[[string]$c]=[int][char]([string]$c).ToUpperInvariant() }
            for ($i=1;$i -le 12;$i++) { $codes["f$i"]=111+$i }
            $ordinary=@($keys | Where-Object { -not $modifiers.ContainsKey($_) })
            if ($ordinary.Count -ne 1 -or -not $codes.ContainsKey($ordinary[0]) -or @($keys | Select-Object -Unique).Count -ne $keys.Count -or ('cmd' -in $keys -and 'win' -in $keys)) { Fail 'invalid_params' '지원하지 않는 키 조합입니다.' }
            $virtualKeys=@(foreach ($key in $keys) { if ($modifiers.ContainsKey($key)) { $modifiers[$key] } }) + @($codes[$ordinary[0]])
            $null=Input-Target $apps $true $keys
            [HeisenNative]::Chord([ushort[]]$virtualKeys)
        }
        'scroll' {
            $point=Point $request; $dx=Integer $request 'dx' 0 -100000 100000; $dy=Integer $request 'dy' 0 -100000 100000
            $null=Pointer-Target $point $apps
            if (-not [HeisenNative]::SetCursorPos($point.X,$point.Y)) { Fail 'input_failed' '포인터를 이동할 수 없습니다.' }
            $null=Pointer-Target $point $apps
            if ($dy -ne 0) { [HeisenNative]::Mouse(0x800,$dy) }
            if ($dx -ne 0) { $null=Pointer-Target $point $apps; [HeisenNative]::Mouse(0x1000,$dx) }
        }
    }
    return @{ok=$true}
}
$timer=New-Object System.Windows.Forms.Timer
$timer.Interval=50
$timer.Add_Tick({
    if ($script:busy) { return }
    $line=$null
    if ([HeisenInput]::Queue.TryDequeue([ref]$line)) {
        $script:busy=$true; $requestId=$null
        try {
            try { $request=ConvertFrom-Json -InputObject $line -ErrorAction Stop } catch { Fail 'invalid_request' '올바른 JSON 요청과 숫자 id가 필요합니다.' }
            if ([Text.Encoding]::UTF8.GetByteCount($line) -gt 1048576 -or $request -isnot [System.Management.Automation.PSCustomObject] -or -not (Is-Number $request.id) -or [math]::Truncate([double]$request.id) -ne $request.id) { Fail 'invalid_request' '올바른 JSON 요청과 숫자 id가 필요합니다.' }
            $requestId=$request.id
            $result=Handle $request
            Emit @{id=$requestId;ok=$true;result=$result}
        } catch {
            $message=$_.Exception.Message
            if ($message -notmatch '^[a-z_]+: ') { $message='operation_failed: 작업을 완료하지 못했습니다. 대화형 데스크톱과 앱 권한을 확인하세요.' }
            Emit @{id=$requestId;ok=$false;error=$message}
        } finally { $script:busy=$false; [void][HeisenInput]::Completed.Set() }
    }
    if ($script:quitting -or [HeisenInput]::Eof) { $script:quitting=$true; $script:context.ExitThread() }
})
try {
    [HeisenInput]::Start(); $timer.Start()
    [System.Windows.Forms.Application]::Run($script:context)
} finally {
    $script:quitting=$true; $timer.Stop(); $timer.Dispose()
    if ($script:panel) { $script:panel.Dispose() }
    $script:context.Dispose()
}
