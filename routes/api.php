<?php

use App\Http\Controllers\Api\MailController;
use Illuminate\Support\Facades\Route;

Route::middleware('api.key')->group(function () {
    Route::post('/mail/sendmail', [MailController::class, 'sendmail']);
});
