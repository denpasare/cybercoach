<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_risk_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('analysis_run_id')->nullable()->constrained('analysis_runs')->nullOnDelete();
            $table->string('domain');
            $table->string('ip')->nullable();

            // DNS checks
            $table->string('spf_status')->default('unknown');   // pass, fail, missing, error
            $table->string('dmarc_status')->default('unknown'); // pass, fail, missing, error
            $table->text('mx_records')->nullable();             // JSON array
            $table->string('mx_status')->default('unknown');    // valid, missing, error

            // Raw DNS data
            $table->text('spf_record')->nullable();
            $table->text('dmarc_record')->nullable();

            // SMTP risk
            $table->integer('smtp_risk_score')->default(0);
            $table->text('smtp_findings')->nullable(); // JSON array of finding strings

            // SES/API risk
            $table->integer('ses_risk_score')->default(0);
            $table->text('ses_findings')->nullable(); // JSON array of finding strings

            // DNS risk contribution
            $table->integer('dns_risk_score')->default(0);

            // Aggregate
            $table->integer('risk_score')->default(0);
            $table->string('risk_level')->default('low'); // low, medium, high, critical

            // Optional metadata inputs
            $table->integer('daily_send_volume')->nullable();
            $table->string('email_provider')->nullable();   // e.g. ses, sendgrid, mailgun, smtp
            $table->boolean('has_api_key_exposed')->default(false);
            $table->boolean('uses_php_mail')->default(false);
            $table->boolean('uses_laravel_queue')->default(false);
            $table->boolean('open_relay_banner')->default(false);
            $table->integer('baseline_volume')->nullable();
            $table->text('reputation_signals')->nullable(); // JSON array

            $table->timestamps();

            $table->index('domain');
            $table->index('risk_level');
            $table->index('risk_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_risk_assets');
    }
};
