param([switch]$DryRun)
$args = @('run', 'startup:install')
if ($DryRun) { $args += @('--', '--dry-run') }
& npm @args
exit $LASTEXITCODE
