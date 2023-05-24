import "./gl-matrix.js";
const { mat2, mat2d, mat4, mat3, quat, quat2, vec2, vec3, vec4 } = glMatrix;

import { InputManager } from "./input_manager.js";
import { Camera } from "./camera.js";

import { create_sphere } from "./mesh.js";

import {
	create_program, resize_canvas, compile_shader,
	create_attribute_setters, create_uniform_setters,
	create_buffer_info_from_arrays,
	set_buffers_and_attributes, set_uniforms
} from "./webgl_helpers.js";

// ###########################
// helper functions
// ###########################

function to_radians(degrees) {
	return degrees * Math.PI / 180;
}

// ###########################
// shaders and maps
// ###########################

var vertex_shader_source = [
	'precision mediump float;',
	'',
	'attribute vec3 pos;',
	'attribute vec3 normal;',
	'varying vec3 frag_normal;',
	'uniform mat4 u_matrix;',
	'uniform mat4 u_inverse_transpose_matrix;',
	'',
	'void main() {',
	'	frag_normal = mat3(u_inverse_transpose_matrix) * normal;',
	'	gl_Position = u_matrix * vec4(pos, 1.0);',
	'}'
].join("\n");

var fragment_shader_source = [
	'precision mediump float;',
	'',
	'varying vec3 frag_normal;',
	'uniform vec3 u_reverse_light;',
	'uniform vec4 u_color;',
	'',
	'void main() {',
	'	float light = dot(frag_normal, u_reverse_light);',
	'	gl_FragColor = u_color;',
	'	gl_FragColor.rgb *= light;',
	'}'
].join("\n");

var triangle = [
	-5.0, 0.0, 3.0, 0.0, 1.0, 1.0,
	5.0, 0.0, -3.0, 0.0, 1.0, 1.0,
	0.0, 7.0, 0.0, 0.0, 1.0, 1.0,
]

var pyramid = [
	-1.0, 0.0, 1.0,
	0.0, 3.0, 0.0,
	-1.0, 0.0, -1.0,

	1.0, 0.0, 1.0,
	0.0, 3.0, 0.0,
	-1.0, 0.0, 1.0,

	-1.0, 0.0, -1.0,
	0.0, 3.0, 0.0,
	1.0, 0.0, -1.0,

	1.0, 0.0, -1.0,
	0.0, 3.0, 0.0,
	1.0, 0.0, 1.0,

	-1.0, 0.0, 1.0,
	1.0, 0.0, -1.0,
	1.0, 0.0, 1.0,

	1.0, 0.0, -1.0,
	-1.0, 0.0, 1.0,
	-1.0, 0.0, -1.0,
]

var pyramid_shifted = [
	2.0, 0.0, 1.0,
	3.0, 3.0, 0.0,
	2.0, 0.0, -1.0,

	4.0, 0.0, 1.0,
	3.0, 3.0, 0.0,
	2.0, 0.0, 1.0,

	2.0, 0.0, -1.0,
	3.0, 3.0, 0.0,
	4.0, 0.0, -1.0,

	4.0, 0.0, -1.0,
	3.0, 3.0, 0.0,
	4.0, 0.0, 1.0,

	2.0, 0.0, 1.0,
	4.0, 0.0, -1.0,
	4.0, 0.0, 1.0,

	4.0, 0.0, -1.0,
	2.0, 0.0, 1.0,
	2.0, 0.0, -1.0,
];

// ###########################
// graphics helper functions
// ###########################

function get_normal(p1, p2, p3) {
	var v1 = [
		p1[0] - p2[0],
		p1[1] - p2[1],
		p1[2] - p2[2],
	]

	var v2 = [
		p1[0] - p3[0],
		p1[1] - p3[1],
		p1[2] - p3[2],
	]

	var cross = [0, 0, 0];
	vec3.cross(cross, v1, v2);
	vec3.normalize(cross, cross);

	var scalar = vec3.dot(cross, [0, 0, 0]);
	if (scalar > 0) {
		cross[0] *= -1;
		cross[1] *= -1;
		cross[2] *= -1;
	}

	return cross;
}

function calculate_normals(vertices) {
	var normals = [];
	for (var i = 0; i < vertices.length; i += 9) {
		var p1 = vertices.slice(i, i + 3);
		var p2 = vertices.slice(i + 3, i + 6);
		var p3 = vertices.slice(i + 6, i + 9);

		var normal = get_normal(p1, p2, p3);
		normals.push(...normal, ...normal, ...normal);
	}

	return normals;
}

// ###########################
// driver code
// ###########################

function main() {
	const canvas = document.querySelector("#glcanvas");
	/** @type {WebGLRenderingContext} */
	const gl = canvas.getContext('webgl');

	if (!gl) {
		console.log("failed to get webgl");
		return;
	}

	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.frontFace(gl.CCW);
	gl.cullFace(gl.BACK);

	// init time
	var uniform_reverse_light = [-0.5, 0.0, -1.0];
	var uniform_color = [0.0, 0.25, 1.0, 1.0];
	var normals = calculate_normals(pyramid);

	var vertex_shader = compile_shader(gl, gl.VERTEX_SHADER, vertex_shader_source);
	var fragment_shader = compile_shader(gl, gl.FRAGMENT_SHADER, fragment_shader_source);

	var program = create_program(gl, vertex_shader, fragment_shader);

	var attribute_arrays = {
		pos: { size: 3, data: new Float32Array(pyramid) },
		normal: { size: 3, data: new Float32Array(normals) },
	};

	var attribute_setters = create_attribute_setters(gl, program);

	var buffer_info = create_buffer_info_from_arrays(gl, attribute_arrays);

	var uniform_setters = create_uniform_setters(gl, program);

	gl.useProgram(program);

	set_buffers_and_attributes(gl, attribute_setters, buffer_info);

	//###########################
	// fps counter
	//###########################
	const fpsElem = document.querySelector("#fps");
	const frameTimes = [];
	let frameCursor = 0;
	let numFrames = 0;
	const maxFrames = 20;
	let totalFPS = 0;
	let then = 0;

	function compute_average_fps(now) {
		now *= 0.001;
		const deltaTime = now - then;
		then = now;
		const fps = 1 / deltaTime;

		fpsElem.textContent = fps.toFixed(1);
		totalFPS += fps - (frameTimes[frameCursor] || 0);
		frameTimes[frameCursor++] = fps;
		numFrames = Math.max(numFrames, frameCursor);
		frameCursor %= maxFrames;
		const averageFPS = totalFPS / numFrames;

		return averageFPS;
	}

	//###########################
	// render loop
	//###########################

	// init matrices

	var angle = 0;

	var input_manager = new InputManager(canvas);
	var camera = new Camera(canvas.clientHeight, canvas.clientHeight);

	var render = function (now) {
		var proj_matrix = mat4.create();
		var camera_matrix = mat4.create();
		var view_matrix = mat4.create();
		var view_proj_matrix = mat4.create();

		// calculate fps
		fpsElem.textContent = compute_average_fps(now).toFixed(1);

		// handle input
		var direction = camera.get_direction();

		var movement = input_manager.get_move_vector();
		var wheel = input_manager.get_wheel_vector(direction);

		camera.transform(movement, wheel, view_proj_matrix);

		mat4.identity(view_proj_matrix);
		mat4.lookAt(view_matrix, camera.pos, camera.look_at, [0, 1, 0]);
		mat4.perspective(proj_matrix, to_radians(45), canvas.clientWidth / canvas.clientHeight, 0.1, 1000.0);
		mat4.mul(proj_matrix, proj_matrix, view_matrix);
		mat4.mul(proj_matrix, proj_matrix, view_proj_matrix);

		// mat4.perspective(proj_matrix, to_radians(45), canvas.clientWidth / canvas.clientHeight, 0.1, 1000.0);
		// mat4.lookAt(camera_matrix, camera.pos, camera.look_at, [0, 1, 0]);
		// mat4.invert(view_matrix, camera_matrix);
		// mat4.mul(view_proj_matrix, proj_matrix, view_matrix);

		var uniform_arrays = {
			u_reverse_light: { data: new Float32Array(uniform_reverse_light) },
			u_color: { data: new Float32Array(uniform_color) },
			u_matrix: { data: proj_matrix},
			u_inverse_transpose_matrix: { data: mat4.transpose(mat4.create(), mat4.invert(mat4.create(), view_proj_matrix)) },
		};

		angle = performance.now() / 1000 / 12 * 2 * Math.PI;
		// mat4.rotate(proj_matrix, proj_matrix, angle, [0, 1, 0]);

		set_uniforms(uniform_setters, uniform_arrays);

		gl.clearColor(0.0, 0.0, 0.0, 0.5);
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 18);

		requestAnimationFrame(render);
	};
	requestAnimationFrame(render);
}

main();