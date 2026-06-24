<?php

use App\Http\Controllers\MailLogController;
use App\Http\Controllers\WabController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [MailLogController::class, 'index'])->name('dashboard');

    Route::get('wab', [WabController::class, 'index'])->name('wab');
    Route::get('wab/status', [WabController::class, 'status'])->name('wab.status');
    Route::post('wab/pair', [WabController::class, 'pair'])->name('wab.pair');
    Route::post('wab/reconnect', [WabController::class, 'reconnect'])->name('wab.reconnect');
    Route::post('wab/logout', [WabController::class, 'logout'])->name('wab.logout');
    Route::post('wab/send-test', [WabController::class, 'sendTest'])->name('wab.send-test');
});

require __DIR__.'/settings.php';
