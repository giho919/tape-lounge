Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

function C([string]$value) { [System.Drawing.ColorTranslator]::FromHtml($value) }
function DrawText($g,[string]$text,[string]$family,[float]$size,[System.Drawing.FontStyle]$style,[System.Drawing.Color]$color,[float]$x,[float]$y) {
  $font = [System.Drawing.Font]::new($family,$size,$style,[System.Drawing.GraphicsUnit]::Pixel)
  $brush = [System.Drawing.SolidBrush]::new($color)
  $g.DrawString($text,$font,$brush,$x,$y)
  $brush.Dispose(); $font.Dispose()
}
function RoundRect($g,[System.Drawing.RectangleF]$r,[float]$radius,[System.Drawing.Color]$fill,[System.Drawing.Color]$stroke) {
  $p=[System.Drawing.Drawing2D.GraphicsPath]::new(); $d=$radius*2
  $p.AddArc($r.X,$r.Y,$d,$d,180,90); $p.AddArc($r.Right-$d,$r.Y,$d,$d,270,90)
  $p.AddArc($r.Right-$d,$r.Bottom-$d,$d,$d,0,90); $p.AddArc($r.X,$r.Bottom-$d,$d,$d,90,90); $p.CloseFigure()
  $b=[System.Drawing.SolidBrush]::new($fill); $pen=[System.Drawing.Pen]::new($stroke,1)
  $g.FillPath($b,$p); $g.DrawPath($pen,$p); $b.Dispose(); $pen.Dispose(); $p.Dispose()
}

$cards = @(
  @{lang='ko';font='Malgun Gothic';eyebrow='MACRO DESK  /  ECONOMIC RELEASES';headline1='숫자보다,';headline2='시장의 반응.';sub1='CPI · 고용 · FOMC';sub2='발표 뒤 비트코인 움직임까지';schedule='공식 일정';result='확인된 결과';reaction='BTC 가격 반응';alt='미국 CPI와 고용·FOMC 발표 일정, 결과와 비트코인 반응을 보여주는 Tape Lounge 발표장'},
  @{lang='en';font='Segoe UI';eyebrow='MACRO DESK  /  ECONOMIC RELEASES';headline1='Beyond the number,';headline2='watch the response.';sub1='CPI · JOBS · FOMC';sub2='Then see how Bitcoin moved.';schedule='OFFICIAL SCHEDULE';result='CONFIRMED DATA';reaction='BTC PRICE RESPONSE';alt='Tape Lounge macro desk for official U.S. CPI, jobs and FOMC releases and Bitcoin price reactions'},
  @{lang='zh';font='Microsoft YaHei';eyebrow='宏观观察  /  经济数据';headline1='不只看数据，';headline2='更看市场反应。';sub1='CPI · 就业 · FOMC';sub2='查看发布后的比特币走势';schedule='官方日程';result='已确认结果';reaction='BTC价格反应';alt='Tape Lounge宏观观察：美国CPI、就业和FOMC官方日程、结果及比特币价格反应'},
  @{lang='ja';font='MS Gothic';eyebrow='MACRO DESK  /  経済指標';headline1='数字だけでなく、';headline2='市場の反応を見る。';sub1='CPI · 雇用 · FOMC';sub2='発表後のビットコインの動きも';schedule='公式日程';result='確定した結果';reaction='BTC価格の反応';alt='米国のCPI、雇用、FOMCの公式日程と結果、その後のビットコイン価格反応を確認できるTape Lounge'}
)

foreach($card in $cards) {
  $bmp=[System.Drawing.Bitmap]::new(1200,630)
  $g=[System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $rect=[System.Drawing.Rectangle]::new(0,0,1200,630)
  $bg=[System.Drawing.Drawing2D.LinearGradientBrush]::new($rect,(C '#0a0c10'),(C '#171a1f'),35)
  $g.FillRectangle($bg,$rect); $bg.Dispose()
  $gold=C '#dabb4a'; $muted=C '#969ca5'; $white=C '#f2efe7'; $panel=C '#11161c'; $line=C '#383126'
  RoundRect $g ([System.Drawing.RectangleF]::new(28,28,1144,574)) 20 (C '#0d1015') (C '#4a4028')
  RoundRect $g ([System.Drawing.RectangleF]::new(66,48,40,40)) 11 (C '#1b1d1e') (C '#5c4c25')
  DrawText $g 't.' 'Georgia' 25 ([System.Drawing.FontStyle]::Bold) $gold 77 53
  DrawText $g 'TAPE LOUNGE' 'Georgia' 22 ([System.Drawing.FontStyle]::Bold) $gold 122 54
  DrawText $g $card.eyebrow 'Segoe UI' 12 ([System.Drawing.FontStyle]::Bold) $muted 778 62
  $rule=[System.Drawing.Pen]::new((C '#433a29'),1); $g.DrawLine($rule,67,109,1133,109); $rule.Dispose()

  $headlineSize=if($card.lang -eq 'en'){39}else{44}
  DrawText $g $card.headline1 $card.font $headlineSize ([System.Drawing.FontStyle]::Bold) $white 76 163
  DrawText $g $card.headline2 $card.font $headlineSize ([System.Drawing.FontStyle]::Bold) $gold 76 222
  DrawText $g $card.sub1 $card.font 23 ([System.Drawing.FontStyle]::Bold) (C '#d9dce1') 80 319
  DrawText $g $card.sub2 $card.font 18 ([System.Drawing.FontStyle]::Regular) (C '#aeb4bd') 80 359

  $chipFill=C '#1a1e24'; $chipBorder=C '#3c3527'
  RoundRect $g ([System.Drawing.RectangleF]::new(78,430,96,36)) 18 $chipFill $chipBorder
  RoundRect $g ([System.Drawing.RectangleF]::new(185,430,96,36)) 18 $chipFill $chipBorder
  RoundRect $g ([System.Drawing.RectangleF]::new(292,430,106,36)) 18 $chipFill $chipBorder
  DrawText $g 'CPI' 'Segoe UI' 13 ([System.Drawing.FontStyle]::Bold) $gold 108 439
  DrawText $g 'JOBS' 'Segoe UI' 13 ([System.Drawing.FontStyle]::Bold) $gold 212 439
  DrawText $g 'FOMC' 'Segoe UI' 13 ([System.Drawing.FontStyle]::Bold) $gold 317 439
  DrawText $g $card.schedule $card.font 12 ([System.Drawing.FontStyle]::Bold) $muted 80 516
  DrawText $g $card.result $card.font 12 ([System.Drawing.FontStyle]::Bold) $muted 80 539
  DrawText $g $card.reaction $card.font 12 ([System.Drawing.FontStyle]::Bold) $muted 80 562
  DrawText $g 'tapelounge.com' 'Segoe UI' 13 ([System.Drawing.FontStyle]::Regular) (C '#9d8546') 80 587

  RoundRect $g ([System.Drawing.RectangleF]::new(615,137,521,426)) 18 $panel (C '#4e4228')
  DrawText $g 'EVENT  →  MARKET RESPONSE' 'Segoe UI' 13 ([System.Drawing.FontStyle]::Bold) $gold 647 160
  DrawText $g 'ILLUSTRATIVE FLOW' 'Segoe UI' 10 ([System.Drawing.FontStyle]::Regular) $muted 946 164
  $gridPen=[System.Drawing.Pen]::new((C '#27303a'),1)
  for($i=0;$i -lt 4;$i++) { $gy=223+$i*54; $g.DrawLine($gridPen,650,$gy,1101,$gy) }
  for($i=0;$i -lt 7;$i++) { $gx=650+$i*75; $g.DrawLine($gridPen,$gx,215,$gx,397) }
  $gridPen.Dispose()
  $eventPen=[System.Drawing.Pen]::new((C '#8d7540'),1.2); $eventPen.DashStyle=[System.Drawing.Drawing2D.DashStyle]::Dash
  $g.DrawLine($eventPen,875,217,875,399); $eventPen.Dispose()
  $values=@(250,235,245,225,240,230,255,240,260,230,242,220,255,235,245,225,240,235,250,230,245,220,236,228,248,235,242,230)
  $pricePen=[System.Drawing.Pen]::new((C '#dabb4a'),3)
  $points=[System.Collections.Generic.List[System.Drawing.Point]]::new()
  for($i=0;$i -lt $values.Count;$i++) { $points.Add([System.Drawing.Point]::new((660+$i*16),(212+$values[$i]*0.52))) }
  $g.DrawLines($pricePen,$points.ToArray()); $pricePen.Dispose()
  $dotBrush=[System.Drawing.SolidBrush]::new((C '#e5c85b')); $g.FillEllipse($dotBrush,870,298,10,10); $dotBrush.Dispose()
  $axis=[System.Drawing.Pen]::new((C '#55482e'),1); $g.DrawLine($axis,648,422,1102,422); $axis.Dispose()
  DrawText $g $card.schedule $card.font 11 ([System.Drawing.FontStyle]::Regular) $muted 650 440
  DrawText $g 'RELEASE' 'Segoe UI' 10 ([System.Drawing.FontStyle]::Bold) $gold 836 440
  DrawText $g $card.reaction $card.font 11 ([System.Drawing.FontStyle]::Regular) $muted 965 440
  $foot=[System.Drawing.Pen]::new((C '#30353b'),1); $g.DrawLine($foot,648,477,1102,477); $foot.Dispose()
  DrawText $g $card.result $card.font 16 ([System.Drawing.FontStyle]::Bold) $white 650 497
  DrawText $g $card.reaction $card.font 12 ([System.Drawing.FontStyle]::Regular) $muted 650 528

  $path=Join-Path (Get-Location) "calendar-og-$($card.lang)-20261110.png"
  $bmp.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output $path
}
