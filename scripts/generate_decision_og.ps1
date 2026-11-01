Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
function C([string]$v) { [System.Drawing.ColorTranslator]::FromHtml($v) }
function RoundBox($g,$brush,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  $p=[System.Drawing.Drawing2D.GraphicsPath]::new(); $d=$r*2
  $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure()
  $g.FillPath($brush,$p); $p.Dispose()
}
function MakeCard([string]$lang,[string]$headline,[string]$subhead,[string]$description,[string]$wait,[string]$enter) {
  $bmp=[System.Drawing.Bitmap]::new(1200,630); $g=[System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $rect=[System.Drawing.Rectangle]::new(0,0,1200,630); $bg=[System.Drawing.Drawing2D.LinearGradientBrush]::new($rect,(C '#0b0f14'),(C '#181a1d'),35); $g.FillRectangle($bg,$rect); $bg.Dispose()
  $gold=C '#d5b65e'; $muted=C '#8d949e'; $white=C '#f4f0e5'; $green=C '#46cc8a'; $red=C '#eb7178'
  $g.DrawLine([System.Drawing.Pen]::new((C '#67552e'),1),60,105,1140,105)
  $g.DrawString('TAPE LOUNGE',[System.Drawing.Font]::new('Georgia',20,[System.Drawing.FontStyle]::Bold),[System.Drawing.SolidBrush]::new($gold),60,48)
  $g.DrawString('DECISION TABLE  /  BTC HISTORY',[System.Drawing.Font]::new('Consolas',9),[System.Drawing.SolidBrush]::new($muted),825,58)
  $g.DrawString($headline,[System.Drawing.Font]::new('Malgun Gothic',42,[System.Drawing.FontStyle]::Bold),[System.Drawing.SolidBrush]::new($white),60,157)
  $g.DrawString($subhead,[System.Drawing.Font]::new('Malgun Gothic',22,[System.Drawing.FontStyle]::Bold),[System.Drawing.SolidBrush]::new($gold),63,225)
  $g.DrawString($description,[System.Drawing.Font]::new('Malgun Gothic',16),[System.Drawing.SolidBrush]::new((C '#b6bbc2')),[System.Drawing.RectangleF]::new(63,282,520,70))
  $chip=[System.Drawing.SolidBrush]::new((C '#1a1e23')); $outline=[System.Drawing.Pen]::new((C '#39352c'),1)
  RoundBox $g $chip 63 385 222 34 17; $g.DrawRectangle($outline,63,385,222,34); RoundBox $g $chip 298 385 223 34 17; $g.DrawRectangle($outline,298,385,223,34)
  $g.DrawString('BTC  ·  HISTORICAL DAILY',[System.Drawing.Font]::new('Consolas',9),[System.Drawing.SolidBrush]::new($gold),77,396)
  $g.DrawString('12 CALLS  ·  5-DAY REVEAL',[System.Drawing.Font]::new('Consolas',9),[System.Drawing.SolidBrush]::new($gold),312,396)
  $g.DrawString('HISTORICAL PRACTICE  ·  NO LIVE ORDERS',[System.Drawing.Font]::new('Consolas',9),[System.Drawing.SolidBrush]::new($muted),63,555)
  $card=[System.Drawing.SolidBrush]::new((C '#11161c')); RoundBox $g $card 620 135 520 430 16; $g.DrawRectangle([System.Drawing.Pen]::new((C '#4a4029'),1.2),620,135,520,430)
  $g.DrawString('BTC / USDT',[System.Drawing.Font]::new('Consolas',10),[System.Drawing.SolidBrush]::new($gold),650,157)
  RoundBox $g ([System.Drawing.SolidBrush]::new((C '#1b2027'))) 990 151 118 27 8; $g.DrawString('DATE HIDDEN',[System.Drawing.Font]::new('Consolas',8),[System.Drawing.SolidBrush]::new($muted),1004,158)
  $grid=[System.Drawing.Pen]::new((C '#252c34'),1); for($i=0;$i -lt 4;$i++){ $g.DrawLine($grid,650,210+58*$i,1110,210+58*$i) }; for($i=0;$i -lt 7;$i++){ $g.DrawLine($grid,650+76*$i,205,650+76*$i,392) }
  $vals=@(305,295,311,278,286,264,281,246,252,221,239,208,220,184,199,171,180,151,164,130,144,116); $base=663; $top=212
  for($i=0;$i -lt $vals.Count-1;$i++) { $y1=$top+$vals[$i]*0.62; $y2=$top+$vals[$i+1]*0.62; $co=if($y2 -lt $y1){$green}else{$red}; $x=$base+20*$i; $g.DrawLine([System.Drawing.Pen]::new($co,2),$x+5,[Math]::Min($y1,$y2)-9,$x+5,[Math]::Max($y1,$y2)+9); $g.FillRectangle([System.Drawing.SolidBrush]::new($co),$x,[Math]::Min($y1,$y2),10,[Math]::Max(6,[Math]::Abs($y2-$y1))) }
  for($i=0;$i -lt 18;$i++){ $x1=$base+23*$i; $x2=$base+23*($i+1); $y1=380-4*$i+([Math]::Sin($i*.78)*7); $y2=380-4*($i+1)+([Math]::Sin(($i+1)*.78)*7); $g.DrawLine([System.Drawing.Pen]::new($gold,2),$x1,$y1,$x2,$y2) }
  $g.DrawString('SMA 20',[System.Drawing.Font]::new('Consolas',8),[System.Drawing.SolidBrush]::new($gold),1036,314)
  RoundBox $g ([System.Drawing.SolidBrush]::new((C '#191e25'))) 650 425 218 65 9; $g.DrawRectangle([System.Drawing.Pen]::new((C '#414750'),1),650,425,218,65)
  RoundBox $g ([System.Drawing.SolidBrush]::new((C '#392f19'))) 880 425 228 65 9; $g.DrawRectangle([System.Drawing.Pen]::new((C '#907841'),1),880,425,228,65)
  $bf=[System.Drawing.Font]::new('Malgun Gothic',14,[System.Drawing.FontStyle]::Bold); $g.DrawString($wait,$bf,[System.Drawing.SolidBrush]::new($white),670,444); $g.DrawString($enter,$bf,[System.Drawing.SolidBrush]::new($gold),900,444)
  $g.DrawString('CHOOSE FIRST. SEE THE NEXT 5 DAYS AFTER.',[System.Drawing.Font]::new('Consolas',8),[System.Drawing.SolidBrush]::new($muted),650,520)
  $bmp.Save((Join-Path (Get-Location) "decision-og-$lang-20261101.png"),[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}
MakeCard 'ko' '그때, 당신이라면?' '5일 뒤를 보기 전에 결정하세요.' 'BTC 과거 차트에서 12번의 선택을 하고 결과를 확인하세요.' '관망하기' '25% 진입'
MakeCard 'en' 'What would you do?' 'Decide before the next five days appear.' 'Make 12 calls on historical BTC charts, then review your decisions.' 'WAIT' 'ENTER 25%'
MakeCard 'zh' '如果当时是你？' '先决定，再看接下来的五天。' '在比特币历史行情中做出 12 次选择，再回顾结果。' '观望' '买入 25%'
MakeCard 'ja' 'あの時、自分なら？' '5日後を見る前に、判断する。' 'BTCの過去チャートで12回判断し、その結果を振り返ります。' '様子見' '25%購入'
