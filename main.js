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
	'	gl_FragColor.rgb *= light;',
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

	//###########################
	// render loop
	//###########################

	var scene = new Scene(gl, canvas.clientHeight, canvas.clientWidth, canvas);
	scene.init_program(vertex_shader_source, fragment_shader_source);

	for (var i = 0; i < 3; i++) {
		var radius = 2.5 * Math.random() + 0.5;
		var sphere_return = create_sphere(Math.random() * radius + 0.5);
		
		var vertices = sphere_return.vertices;
		var normals = sphere_return.normals;
		var indices = sphere_return.indices;

		var translation = [i * 3, i * 2, 0];
		var rotation_x = 0;
		var rotation_y = 0;

		scene.add_object(vertices, normals, indices, translation, rotation_x, rotation_y);
	}
	
	var render = function (now) {
		// calculate fps
		fpsElem.textContent = compute_average_fps(now).toFixed(1);

		gl.clearColor(0.0, 0.25, 0.0, 0.5);
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

		scene.draw_scene();

		requestAnimationFrame(render);
	};
	requestAnimationFrame(render);
}

main();