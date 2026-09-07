using System.Runtime.InteropServices;
using System.IO;
using System.Text.Json;
using System.Windows.Automation;
using Windows.Media.Ocr;
using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;

class Program
{
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vKey);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("kernel32.dll")] static extern uint SetErrorMode(uint mode);
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X; public int Y; }
    static void Emit(object result) { Console.WriteLine(JsonSerializer.Serialize(result)); Console.Out.Flush(); }
    [STAThread] static int Main(string[] args)
    {
        Console.OutputEncoding = new System.Text.UTF8Encoding(false);
        SetErrorMode(0x0001|0x0002|0x8000);
        SetProcessDpiAwarenessContext(new IntPtr(-4));
        try {
            if(args[0] == "pick-region") RegionPicker.Run(Emit);
            else if(args[0] == "material") MaterialHost.Run(new IntPtr(long.Parse(args[1])));
            else if(args[0] == "languages") Emit(OcrEngine.AvailableRecognizerLanguages.Select(l => new { code=l.LanguageTag, name=l.DisplayName }));
            else if(args[0] == "selection-once") SelectionWatcher.Probe(args,Emit);
            else if(args[0] == "ocr") Ocr(args).GetAwaiter().GetResult();
            else if(args[0] == "watch") { var thread=new Thread(()=>SelectionWatcher.Watch(uint.Parse(args[1]),Emit)); thread.SetApartmentState(ApartmentState.MTA); thread.Start(); thread.Join(); }
            return 0;
        } catch(Exception e) { Emit(new {error=e.Message}); return 1; }
    }
    static async Task Ocr(string[] args)
    {
        int x=int.Parse(args[1]),y=int.Parse(args[2]),w=int.Parse(args[3]),h=int.Parse(args[4]);
        if(w<5 || h<5 || w>OcrEngine.MaxImageDimension || h>OcrEngine.MaxImageDimension) throw new Exception("选区尺寸超出 OCR 范围，请缩小选区。");
        var requested=args[5];
        OcrEngine? engine=requested=="auto" ? OcrEngine.TryCreateFromUserProfileLanguages() : OcrEngine.TryCreateFromLanguage(new Language(requested));
        if(engine==null) throw new Exception("此语言的 Windows 文字识别包尚未安装，请在语言与模型中打开 Windows 语言设置。");
        using var bitmap=new System.Drawing.Bitmap(w,h);
        using(var graphics=System.Drawing.Graphics.FromImage(bitmap)) graphics.CopyFromScreen(x,y,0,0,new System.Drawing.Size(w,h));
        int scale=(w*2<=OcrEngine.MaxImageDimension&&h*2<=OcrEngine.MaxImageDimension)?2:1;
        using var enhanced=new System.Drawing.Bitmap(w*scale,h*scale);
        using(var g=System.Drawing.Graphics.FromImage(enhanced)){g.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;g.DrawImage(bitmap,0,0,w*scale,h*scale);}
        using var stream=new MemoryStream(); enhanced.Save(stream,System.Drawing.Imaging.ImageFormat.Png);
        using var random=new InMemoryRandomAccessStream();
        using(var writer=new DataWriter(random.GetOutputStreamAt(0))) { writer.WriteBytes(stream.ToArray()); await writer.StoreAsync(); }
        var decoder=await BitmapDecoder.CreateAsync(random);
        using var software=await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8,BitmapAlphaMode.Premultiplied);
        var result=await engine.RecognizeAsync(software);
        Emit(new {text=string.Join("\n",result.Lines.Select(l=>System.Text.RegularExpressions.Regex.IsMatch(l.Text,@"^[?*□�\s]+$")?"":l.Text.Replace("�"," ").Replace("□"," "))), language=engine.RecognizerLanguage.LanguageTag});
    }
}
