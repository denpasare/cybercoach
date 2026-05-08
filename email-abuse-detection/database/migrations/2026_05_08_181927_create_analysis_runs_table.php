<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analysis_runs', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->integer('total_domains')->default(0);
            $table->integer('high_risk_count')->default(0);
            $table->integer('medium_risk_count')->default(0);
            $table->integer('low_risk_count')->default(0);
            $table->string('status')->default('pending'); // pending, running, complete, failed
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analysis_runs');
    }
};
