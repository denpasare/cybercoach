<?php

use App\Http\Controllers\AnalysisController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

// Individual asset detail and delete
Route::get('/assets/{asset}', [DashboardController::class, 'show'])->name('assets.show');
Route::delete('/assets/{asset}', [DashboardController::class, 'destroy'])->name('assets.destroy');

// CSV export
Route::get('/export', [DashboardController::class, 'export'])->name('export');

// Analysis: single domain or CSV batch
Route::get('/analyze', [AnalysisController::class, 'create'])->name('analyze.create');
Route::post('/analyze/single', [AnalysisController::class, 'storeSingle'])->name('analyze.single');
Route::post('/analyze/batch', [AnalysisController::class, 'storeBatch'])->name('analyze.batch');
