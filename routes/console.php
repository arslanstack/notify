<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Weekly wab session health check + keep-warm (see App\Console\Commands\CheckWabHealth).
Schedule::command('wab:health-check')->weekly();
