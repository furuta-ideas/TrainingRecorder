$ErrorActionPreference = 'Stop'
$trainingProject = Split-Path -Parent $PSScriptRoot
$trainingSecureKey = Read-Host 'ResendのAPIキー（画面には表示しません）' -AsSecureString
$trainingKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($trainingSecureKey)
try {
    $trainingPlainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($trainingKeyPointer).Trim()
    if (-not $trainingPlainKey.StartsWith('re_') -or $trainingPlainKey.Contains("`n") -or $trainingPlainKey.Contains("`r")) {
        throw 'ResendのAPIキーを確認してください。'
    }
    $trainingSecretPath = Join-Path $trainingProject '.env.local'
    [IO.File]::WriteAllText($trainingSecretPath, "RESEND_API_KEY=$trainingPlainKey`nR_BODY_MAIL_FROM=R-Body <onboarding@resend.dev>`n")
    Write-Host '登録準備ができました。チャットに「キーの登録準備ができた」と伝えてください。APIキーは貼り付けないでください。'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($trainingKeyPointer)
    $trainingPlainKey = $null
    $trainingSecureKey.Dispose()
}
