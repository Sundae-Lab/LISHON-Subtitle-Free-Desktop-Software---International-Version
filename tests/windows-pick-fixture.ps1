param([int]$StartX,[int]$StartY,[int]$EndX,[int]$EndY)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class LishonPickerInput {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string cls,string title);
 public static IntPtr FindPicker(){return FindWindow(null,"Lishon region selection");}
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr h,ref Point p);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
 [StructLayout(LayoutKind.Sequential)] public struct Point{public int X,Y;}
 public static void PointMessage(IntPtr h,uint message,int x,int y){var p=new Point{X=x,Y=y};ScreenToClient(h,ref p);SendMessage(h,message,new IntPtr(message==0x202?0:1),new IntPtr((p.Y<<16)|(p.X&65535)));}
}
'@
[LishonPickerInput]::SetThreadDpiAwarenessContext([IntPtr](-4))|Out-Null
$handle=[IntPtr]::Zero
for($i=0;$i -lt 150;$i++){ $handle=[LishonPickerInput]::FindPicker();if($handle -ne [IntPtr]::Zero){break};Start-Sleep -Milliseconds 100 }
if($handle -eq [IntPtr]::Zero){throw 'The Lishon picker is not open; no input sent'}
[LishonPickerInput]::PointMessage($handle,0x201,$StartX,$StartY)
[LishonPickerInput]::PointMessage($handle,0x200,$EndX,$EndY)
[LishonPickerInput]::PointMessage($handle,0x202,$EndX,$EndY)
