import "./gl-matrix.js";
import { create_sphere } from "./mesh.js";
import { create_program, resize_canvas, compile_shader,
		 create_attribute_setters, create_uniform_setters,
		 create_buffer_info_from_arrays,
		 set_buffers_and_attributes, set_uniforms } from "./webgl_helpers.js";
const { mat2, mat2d, mat4, mat3, quat, quat2, vec2, vec3, vec4 } = glMatrix;

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
	'uniform mat4 u_world_location;',
	'',
	'void main() {',
	'	frag_normal = mat3(u_world_location) * normal;',
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
	-1.0, 0.0, -1.0,
	0.0, 3.0, 0.0,

	1.0, 0.0, 1.0,
	-1.0, 0.0, 1.0,
	0.0, 3.0, 0.0,

	-1.0, 0.0, -1.0,
	1.0, 0.0, -1.0,
	0.0, 3.0, 0.0,

	1.0, 0.0, -1.0,
	1.0, 0.0, 1.0,
	0.0, 3.0, 0.0,

	-1.0, 0.0, 1.0,
	1.0, 0.0, -1.0,
	1.0, 0.0, 1.0,

	-1.0, 0.0, 1.0,
	1.0, 0.0, -1.0,
	-1.0, 0.0, -1.0,
]

// ###########################
// webgl boilerplate
// ###########################

// function resize_canvas(canvas) {
// 	const displayWidth = canvas.clientWidth;
// 	const displayHeight = canvas.clientHeight;

// 	const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;

// 	if (needResize) {
// 		canvas.width = displayWidth;
// 		canvas.height = displayHeight;
// 	}

// 	return needResize;
// }

// /** @param{WebGLRenderingContext} gl */
// function compile_shader(gl, type, source) {
// 	var shader = gl.createShader(type);
// 	gl.shaderSource(shader, source);
// 	gl.compileShader(shader);
// 	var ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
// 	if (ok) {
// 		console.log(`Compiled ${type} shader successfully`);
// 		return shader;
// 	}

// 	console.log("Failed to compile shader");
// 	console.log(gl.getShaderInfoLog(shader));
// 	gl.deleteShader(shader);
// }

// /** @param{WebGLRenderingContext} gl */
// function create_program(gl, vertex_shader, fragment_shader) {
// 	var program = gl.createProgram();
// 	gl.attachShader(program, vertex_shader);
// 	gl.attachShader(program, fragment_shader);
// 	gl.linkProgram(program);

// 	var ok = gl.getProgramParameter(program, gl.LINK_STATUS);
// 	if (ok) {
// 		console.log("Program linked successfully");
// 		return program;
// 	}

// 	console.log("Failed to link program");
// 	console.log(gl.getProgramInfoLog(program));
// 	gl.deleteProgram(program);
// }

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

	// compiling shaders

	// var vertex_shader = compile_shader(gl, gl.VERTEX_SHADER, vertex_shader_source);
	// var fragment_shader = compile_shader(gl, gl.FRAGMENT_SHADER, fragment_shader_source);

	// var program = create_program(gl, vertex_shader, fragment_shader);


	// resize_canvas(canvas);
	// gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	// var pos_attrib_location = gl.getAttribLocation(program, 'pos');
	// var normal_attrib_location = gl.getAttribLocation(program, 'normal');

	// const icosphere_return = create_sphere(10);
	// const icosphere_vertices = icosphere_return.vertices;
	// const icosphere_indices = icosphere_return.indices;
	// const icosphere_normals = icosphere_return.normals;

	// console.log(icosphere_indices);
	// console.log(icosphere_vertices);

	// // loading the data for the shape

	// gl.enableVertexAttribArray(pos_attrib_location);

	// var pos_buffer = gl.createBuffer();
	// gl.bindBuffer(gl.ARRAY_BUFFER, pos_buffer);
	// gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(icosphere_vertices), gl.STATIC_DRAW);

	// var size = 3;
	// var type = gl.FLOAT;
	// var normalize = false;
	// var stride = 0
	// var offset = 0;
	// gl.vertexAttribPointer(pos_attrib_location, size, type, normalize, stride, offset);

	// // loading the indices for an icosphere

	// var index_buffer = gl.createBuffer();
	// gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
	// gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(icosphere_indices), gl.STATIC_DRAW);

	// // loading the data for the normals

	// var normal_buffer = gl.createBuffer();
	// gl.bindBuffer(gl.ARRAY_BUFFER, normal_buffer);
	// // var normals = calculate_normals(icosphere_vertices);
	// gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(icosphere_normals), gl.STATIC_DRAW);

	// gl.enableVertexAttribArray(normal_attrib_location);

	// var size = 3;
	// var type = gl.FLOAT;
	// var normalize = false;
	// var stride = 0
	// var offset = 0
	// gl.vertexAttribPointer(normal_attrib_location, size, type, normalize, stride, offset);

	// testing
	var uniform_reverse_light = [-0.5, 0.0, -1.0];
	var uniform_color = [0.0, 0.25, 1.0, 1.0];
	var normals = calculate_normals(pyramid);

	console.log(normals);

	var vertex_shader = compile_shader(gl, gl.VERTEX_SHADER, vertex_shader_source);
	var fragment_shader = compile_shader(gl, gl.FRAGMENT_SHADER, fragment_shader_source);

	var program = create_program(gl, vertex_shader, fragment_shader);

	var attribute_arrays = {
		pos: { size: 3, data: new Float32Array(pyramid) },
		normal: { size: 3, data: new Float32Array(normals) },
	};

	var uniform_arrays = {
		u_reverse_light: { data: new Float32Array(uniform_reverse_light) },
		u_color: { data: new Float32Array(uniform_color) },
	};

	var buffer_info = create_buffer_info_from_arrays(gl, attribute_arrays);

	var uniform_setters = create_uniform_setters(gl, program);

	var attribute_setters = create_attribute_setters(gl, program);

	gl.useProgram(program);

	set_buffers_and_attributes(gl, attribute_setters, buffer_info);
	set_uniforms(uniform_setters, uniform_arrays);
	// end testing

	// create the matrix for the scene render

	var view_matrix = new Float32Array(16);
	var proj_matrix = new Float32Array(16);
	var world_matrix = new Float32Array(16);

	var u_mat_uniform_location = gl.getUniformLocation(program, 'u_matrix');
	var u_normal_rotation_uniform_location = gl.getUniformLocation(program, 'u_world_location');
	// var u_color_uniform_location = gl.getUniformLocation(program, 'u_color');
	// var u_reverse_light_location = gl.getUniformLocation(program, 'u_reverse_light');

	// var reverse_light = [-0.5, 0.0, -1.0];

	// gl.uniform4fv(u_color_uniform_location, [0.0, 0.25, 1.0, 1.0]);
	// gl.uniform3fv(u_reverse_light_location, reverse_light);

	var angle = 0;

	var loop = function () {

		mat4.identity(world_matrix);
		mat4.lookAt(view_matrix, [0, 1, 10], [0, 0, 0], [0, 1, 0]);
		mat4.perspective(proj_matrix, to_radians(45), canvas.clientWidth / canvas.clientHeight, 0.1, 1000.0);
		mat4.mul(proj_matrix, proj_matrix, view_matrix);
		mat4.mul(proj_matrix, proj_matrix, world_matrix);

		angle = performance.now() / 1000 / 6 * 2 * Math.PI;
		// mat4.rotate(proj_matrix, proj_matrix, angle, [0, 1, 0]);
		gl.uniformMatrix4fv(u_mat_uniform_location, false, proj_matrix);
		gl.uniformMatrix4fv(u_normal_rotation_uniform_location, false, proj_matrix);

		gl.clearColor(0.25, 0.0, 0.7, 0.45);
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 18);
		// gl.drawElements(gl.TRIANGLES, icosphere_indices.length, gl.UNSIGNED_SHORT, 0);

		requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
}

main();