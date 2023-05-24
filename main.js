import "./gl-matrix.js";
const { mat2, mat2d, mat4, mat3, quat, quat2, vec2, vec3, vec4 } = glMatrix;

import { InputManager } from "./input_manager.js";
import { Camera } from "./camera.js";
import { Scene } from "./scene.js";

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
	'uniform mat4 u_world_matrix;',
	'',
	'void main() {',
	'	frag_normal = mat3(u_world_matrix) * normal;',
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
	'	vec3 normal = normalize(frag_normal);',
	'	float light = dot(normal, u_reverse_light);',
	'	gl_FragColor = u_color;',
	// '	gl_FragColor.rgb *= light;',
	'}'
].join("\n");

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

	// ###########################
	// init time
	// ###########################

	// var sphere_return = create_sphere(2.5);

	// var position = pyramid;
	// var normals = calculate_normals(pyramid);
	// var indices = [];

	// // console.log(indices);

	// var uniform_reverse_light = [0.5, 0.0, 1.0];
	// var uniform_color = [0.0, 0.25, 1.0, 1.0];
	// var normals = calculate_normals(pyramid);

	// var attribute_arrays = {
	// 	pos: { size: 3, data: new Float32Array(position) },
	// 	normal: { size: 3, data: new Float32Array(normals) },
	// 	indices: { size: 1, data: new Uint16Array(indices) },
	// };

	// var vertex_shader = compile_shader(gl, gl.VERTEX_SHADER, vertex_shader_source);
	// var fragment_shader = compile_shader(gl, gl.FRAGMENT_SHADER, fragment_shader_source);

	// var program = create_program(gl, vertex_shader, fragment_shader);

	// var attribute_setters = create_attribute_setters(gl, program);

	// var buffer_info = create_buffer_info_from_arrays(gl, attribute_arrays);

	// var uniform_setters = create_uniform_setters(gl, program);

	// gl.useProgram(program);

	// set_buffers_and_attributes(gl, attribute_setters, buffer_info);

	// goes into the scene class once it is figured out
	function compute_matrix(view_proj_matrix, translation, rotation_x, rotation_y) {
		var matrix = mat4.create();
		mat4.translate(matrix, matrix, translation);
		mat4.rotateX(matrix, matrix, rotation_x);
		mat4.rotateY(matrix, matrix, rotation_y);
		mat4.multiply(matrix, view_proj_matrix, matrix);
		return matrix;
	}

	//###########################
	// render loop
	//###########################

	function get_random_rgb_value() {
        return [Math.random(), Math.random(), Math.random(), 1.0];
    }

	// var angle = 0;

	// var proj_matrix = mat4.create();
	// var camera_matrix = mat4.create();
	// var view_matrix = mat4.create();
	// var view_proj_matrix = mat4.create();

	// var input_manager = new InputManager(canvas);
	// var camera = new Camera(canvas.clientHeight, canvas.clientHeight);

	var scene = new Scene(gl, canvas.clientHeight, canvas.clientWidth, canvas);
	scene.init_program(vertex_shader_source, fragment_shader_source);

	// var objects_to_render = [];

	// var sphere_uniforms = {
	// 	u_reverse_light: {data: new Float32Array(uniform_reverse_light)},
	// 	u_color: {data: new Float32Array(4)},
	// 	u_matrix: {data: mat4.create()},
	// 	u_world: {data: mat4.create()},
	// };

	// for (var i = 0; i < 3; i++) {
	// 	sphere_uniforms.u_color.data = get_random_rgb_value();

	// 	var obj = {
	// 		uniforms: sphere_uniforms,
	// 		translation: [i * 3, i * 2, 0],
	// 		rotation_x: i * 0.5,
	// 		rotation_y: 0,
	// 	};

	// 	objects_to_render.push(obj);
	// }

	for (var i = 0; i < 3; i++) {
		var radius = 2.0;
		var sphere_return = create_sphere(radius);
		
		var vertices = pyramid;
		var normals = calculate_normals(pyramid);
		var indices = [];

		var translation = [i * 3, i * 2, 0];
		var rotation_x = i * 0.5;
		var rotation_y = 0;

		scene.add_object(vertices, normals, indices, translation, rotation_x, rotation_y);
	}
	
	var render = function (now) {
		// calculate fps
		fpsElem.textContent = compute_average_fps(now).toFixed(1);

		gl.clearColor(0.0, 0.25, 0.0, 0.5);
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

		// handle input
		// var direction = camera.get_direction();

		// var movement = input_manager.get_move_vector();
		// var wheel = input_manager.get_wheel_vector(direction);

		// mat4.perspective(proj_matrix, to_radians(45), canvas.clientWidth / canvas.clientHeight, 0.1, 1000.0);
		// mat4.lookAt(camera_matrix, camera.pos, camera.look_at, [0, 1, 0]);
		// mat4.invert(view_matrix, camera_matrix);
		// mat4.mul(view_proj_matrix, proj_matrix, camera_matrix);

		// camera.transform(movement, wheel, view_matrix);

		// angle = performance.now() / 1000 / 12 * 2 * Math.PI;

		scene.draw_scene();

		// return;


		// objects_to_render.forEach(function (object) {
		// 	object.uniforms.u_matrix.data = new Float32Array(compute_matrix(view_proj_matrix, 
		// 																	object.translation, 
		// 																	object.rotation_x, 
		// 																	object.rotation_y));

		// 	console.log(object.uniforms.u_matrix.data);

		// 	// mat4.mul(object.uniforms.u_world_matrix.data, view_proj_matrix, 
		// 	// object.uniforms.u_matrix.data);

		// 	set_uniforms(uniform_setters, object.uniforms);
		// 	gl.drawArrays(gl.TRIANGLES, 0, 18);
		// 	// gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
		// });

		requestAnimationFrame(render);
	};
	requestAnimationFrame(render);
}

main();