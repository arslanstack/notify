<?php

use App\Http\Controllers\MailLogController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [MailLogController::class, 'index'])->name('dashboard');
});

require __DIR__.'/settings.php';
