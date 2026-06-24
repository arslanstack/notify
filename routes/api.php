<?php

use App\Http\Controllers\Api\MailController;
use App\Http\Controllers\Api\WabController;
use Illuminate\Support\Facades\Route;

Route::middleware('api.key')->group(function () {
    Route::post('/mail/sendmail', [MailController::class, 'sendmail']);
    Route::post('/wab/send', [WabController::class, 'send']);
});
