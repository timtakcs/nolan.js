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

var scene_vertex_shader_source = [
    '#version 300 es',
    'precision mediump float;',
    '',
    'in vec3 pos;',
    'in vec3 normal;',
    'out vec3 frag_normal;',
    'uniform mat4 u_matrix;',
    'uniform mat4 u_world_matrix;',
    '',
    'void main() {',
    '    frag_normal = mat3(u_world_matrix) * normal;',
    '    gl_Position = u_matrix * vec4(pos, 1.0);',
    '}'
].join("\n");


var scene_fragment_shader_source = [
    '#version 300 es',
    'precision mediump float;',
    '',
    'in vec3 frag_normal;',
    'uniform vec3 u_reverse_light;',
    'uniform vec4 u_color;',
    'out vec4 out_color;',
    '',
    'void main() {',
    '    vec3 normal = normalize(frag_normal);',
    '    float light = dot(normal, u_reverse_light);',
    '    out_color = u_color;',
    '    out_color.rgb *= light;',
    '}'
].join("\n");


var plane_vertex_shader_source = [
    '#version 300 es',
    'precision mediump float;',
    '',
    // 'in vec3 pos;',
    'uniform mat4 u_matrix;',
	'',
	'out vec3 near_point;',
	'out vec3 far_point;',
    '',
    'const vec3 positions[6] = vec3[](',
    '    vec3(-1.0, 0.0, 1.0),',
    '    vec3(1.0, 0.0, 1.0),',
    '    vec3(-1.0, 0.0, -1.0),',
    '    vec3(-1.0, 0.0, -1.0),',
    '    vec3(1.0, 0.0, 1.0),',
    '    vec3(1.0, 0.0, -1.0)',
    ');',
    '',
	'vec3 unproject(float x, float y, float z, mat4 world) {',
	'   mat4 world_inv = inverse(world);',
	'   vec4 unprojected_point = world_inv * vec4(x, y, z, 1.0);',
	'   return unprojected_point.xyz / unprojected_point.w;',
	'}',
	'',
    'void main() {',
	'    vec3 p = positions[gl_VertexID].xyz;',
	'    near_point = unproject(p.x, p.y, 0.0, u_matrix).xyz;',
	'    far_point = unproject(p.x, p.y, 1.0, u_matrix).xyz;',
    '    gl_Position = u_matrix * vec4(p, 1.0);',
    '}'
].join("\n");

var plane_fragment_shader_source = [
    '#version 300 es',
    'precision mediump float;',
    '',
	'in vec3 near_point;',
	'in vec3 far_point;',
	'',
    'out vec4 out_color;',
    '',
    'void main() {',
	'    float t = -near_point.y / (far_point.y - near_point.y);',
    '    out_color = vec4(0.5, 0.0, 0.2, 1.0);',
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
	const gl = canvas.getContext('webgl2');

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
	// testing the plane code before putting it in the scene
	//###########################

	var plane_vertex_shader = compile_shader(gl, gl.VERTEX_SHADER, plane_vertex_shader_source);
	var plane_fragment_shader = compile_shader(gl, gl.FRAGMENT_SHADER, plane_fragment_shader_source);

	var plane_program = create_program(gl, plane_vertex_shader, plane_fragment_shader);
	gl.useProgram(plane_program);

	var plane_u_matrix = gl.getUniformLocation(plane_program, "u_matrix");


	//###########################
	// render loop
	//###########################

	var scene = new Scene(gl, canvas.clientHeight, canvas.clientWidth, canvas);
	scene.init_program(scene_vertex_shader_source, scene_fragment_shader_source);

	// temporatry objects for a test sim

	var sphere1 = create_sphere(5.0);
	var vertices1 = sphere1.vertices;
	var normals1 = sphere1.normals;
	var indices1 = sphere1.indices;
	var position1 = [30.0, 0.0, 0.0];
	var rotation_x1 = 0;
	var rotation_y1 = 0;
	var mass1 = 50.0;
	var velocity1 = [0.0, 0.0, 0.0];

	scene.add_object(vertices1, normals1, indices1, position1, rotation_x1, rotation_y1, mass1, velocity1);

	var sphere2 = create_sphere(2.0);
	var vertices2 = sphere2.vertices;
	var normals2 = sphere2.normals;
	var indices2 = sphere2.indices;
	var position2 = [60.0, 0.0, 0.0];
	var rotation_x2 = 0;
	var rotation_y2 = 0;
	var mass2 = 1.0;
	var velocity2 = [0.0, 0.0, 0.4];

	scene.add_object(vertices2, normals2, indices2, position2, rotation_x2, rotation_y2, mass2, velocity2);

	var cur = 0;
	var prev = 0;
	var dt = 0;

	var render = function (now) {
		// calculate fps
		fpsElem.textContent = compute_average_fps(now).toFixed(1);

		// update dt
		prev = cur;
		cur = performance.now();

		dt = (cur - prev) / 1000;

		gl.clearColor(0.0, 0.25, 0.0, 0.5);
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

		scene.draw_scene();

		gl.useProgram(plane_program);
		gl.uniformMatrix4fv(plane_u_matrix, false, scene.view_proj_matrix);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		requestAnimationFrame(render);
	};
	requestAnimationFrame(render);
}

main();