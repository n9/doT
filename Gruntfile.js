module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        qunit: {
            files: ['tests.html']
        },
        jshint: {
            main: ['doT.js']
        }
    });

    grunt.registerTask('lint', 'jshint');
    grunt.registerTask('test', ['jshint', 'qunit']);
};