# Converte a planilha de MICE para dados/carteira.csv, que o coletor lê.
#
# A planilha veio como .xls antigo com extensão .xlsx trocada, então nenhuma
# biblioteca comum abre. Este script usa o Excel instalado na máquina, que
# lê os dois formatos sem reclamar.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\planilha-para-csv.ps1 "C:\caminho\Oportunidades_MICE.xlsx"

param(
  [Parameter(Mandatory = $true)][string]$Planilha,
  [string]$Saida = "dados\carteira.csv"
)

if (-not (Test-Path $Planilha)) { Write-Error "Planilha não encontrada: $Planilha"; exit 1 }

$origem = (Resolve-Path $Planilha).Path
$destino = Join-Path (Get-Location) $Saida
New-Item -ItemType Directory -Force -Path (Split-Path $destino) | Out-Null

# O Excel se recusa a abrir alguns arquivos direto da rede ou do OneDrive;
# uma cópia local evita esse caso e garante leitura somente-leitura.
$copia = Join-Path $env:TEMP ("carteira-" + [guid]::NewGuid().ToString('N') + [IO.Path]::GetExtension($origem))
Copy-Item $origem $copia -Force

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$linhas = New-Object System.Collections.ArrayList
[void]$linhas.Add('aba,evento,data,onde,objetivo,contato,email,telefone,valorEstimado,oportunidade')

function Escapar([string]$v) {
  if ($null -eq $v) { return '""' }
  $t = ($v -replace '\s+', ' ').Trim()
  return '"' + ($t -replace '"', '""') + '"'
}

# As abas não têm o mesmo desenho: "Eventos" tem a coluna Onde, "Prospecção
# Proativa" não tem. Ler por posição fixa desloca todo mundo uma casa e o
# e-mail acaba gravado como telefone. Por isso cada aba é mapeada pelo próprio
# cabeçalho, na linha 2.
$destinos = [ordered]@{
  'evento'        = @('evento')
  'data'          = @('data')
  'onde'          = @('onde', 'local')
  'objetivo'      = @('objetivo')
  'contato'       = @('contato')
  'email'         = @('email', 'e-mail')
  'telefone'      = @('telefone', 'fone')
  'valorEstimado' = @('valor estimado', 'valor')
  'oportunidade'  = @('oportunidade')
}

function Normalizar([string]$s) {
  $t = $s.ToLowerInvariant().Trim()
  $t = $t -replace '[áàâã]', 'a' -replace '[éê]', 'e' -replace '[íî]', 'i'
  $t = $t -replace '[óôõ]', 'o' -replace '[úû]', 'u' -replace 'ç', 'c'
  return ($t -replace '\s+', ' ')
}

try {
  $wb = $excel.Workbooks.Open($copia, 0, $true)
  foreach ($ws in $wb.Worksheets) {
    $ur = $ws.UsedRange
    $nl = $ur.Rows.Count
    $nc = $ur.Columns.Count

    # linha 1 é o título "MICE / GESTÃO DE OPORTUNIDADE"; linha 2 é o cabeçalho
    $mapa = @{}
    for ($c = 1; $c -le $nc; $c++) {
      $titulo = Normalizar ([string]$ur.Cells.Item(2, $c).Text)
      if (-not $titulo) { continue }
      foreach ($chave in $destinos.Keys) {
        if ($mapa.ContainsKey($chave)) { continue }
        foreach ($apelido in $destinos[$chave]) {
          if ($titulo -eq (Normalizar $apelido)) { $mapa[$chave] = $c; break }
        }
      }
    }
    if (-not $mapa.ContainsKey('evento')) {
      Write-Host "  aba '$($ws.Name.Trim())' sem coluna Evento reconhecida - ignorada"
      continue
    }

    for ($r = 3; $r -le $nl; $r++) {
      $evento = ([string]$ur.Cells.Item($r, $mapa['evento']).Text).Trim()
      if (-not $evento) { continue }
      $campos = @($ws.Name.Trim())
      foreach ($chave in $destinos.Keys) {
        $campos += if ($mapa.ContainsKey($chave)) { [string]$ur.Cells.Item($r, $mapa[$chave]).Text } else { '' }
      }
      [void]$linhas.Add((($campos | ForEach-Object { Escapar $_ }) -join ','))
    }
    Write-Host "  aba '$($ws.Name.Trim())': colunas reconhecidas = $($mapa.Keys -join ', ')"
  }
  $wb.Close($false)
} finally {
  $excel.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  Remove-Item $copia -Force -ErrorAction SilentlyContinue
}

$linhas | Out-File -FilePath $destino -Encoding utf8
Write-Host "Gravado: $destino  ($($linhas.Count - 1) oportunidades)"
Write-Host "Este arquivo NAO vai para o Git: contem nomes, e-mails e telefones de terceiros."
