param([switch]$DryRun)
$args = @('run', 'startup:uninstall')
if ($DryRun) { $args += @('--', '--dry-run') }
& npm @args
exit $LASTEXITCODE
