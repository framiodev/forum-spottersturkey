<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return Migration::createTable('framio_media_category_schemas', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('parent_id')->nullable();
    $table->string('name');            // e.g. 'Otobüsler'
    $table->string('slug')->unique();  // e.g. 'otobusler'
    $table->string('icon')->default('fas fa-folder');
    $table->text('tag_slugs')->nullable();       // JSON array of Flarum tag slugs
    $table->text('fields_config')->nullable();   // JSON array of field definitions
    $table->text('output_template')->nullable(); // Markdown template string
    $table->integer('sort_order')->default(0);
    $table->timestamps();

    $table->index('parent_id');
    $table->index('slug');
    $table->index('sort_order');
});
