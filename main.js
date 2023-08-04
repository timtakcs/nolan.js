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
	'uniform float u_is_light_source;',
	'out vec4 out_color;',
	'',
	'void main() {',
	'    if (u_is_light_source > 0.0) {',
	'        out_color = u_color;',
	'		 out_color.rgb *= 2.0;',
	'        out_color.a = 1.0;',
	'    }',
	'	else {',
	'    	vec3 normal = normalize(frag_normal);',
	'    	float light = dot(normal, u_reverse_light);',
	'    	out_color = u_color;',
	'    	out_color.rgb *= light;',
	'	}',
	'}'
].join("\n");


var plane_vertex_shader_source = [
	'#version 300 es',
	'precision mediump float;',
	'',
	'uniform mat4 u_matrix;',
	'',
	'out vec3 near_point;',
	'out vec3 far_point;',
	'out mat4 frag_u_matrix;',
	'',
	'const vec3 positions[6] = vec3[](',
	'    vec3(1, 1, 0),',
	'    vec3(-1, -1, 0),',
	'    vec3(-1, 1, 0),',
	'    vec3(-1, -1, 0),',
	'    vec3(1, 1, 0),',
	'    vec3(1, -1, 0)',
	');',
	'',
	'vec3 unproject(float x, float y, float z, mat4 world) {',
	'   mat4 world_inv = inverse(world);',
	'   vec4 unprojected_point = world_inv * vec4(x, y, z, 1.0);',
	'   return unprojected_point.xyz / unprojected_point.w;',
	'}',
	'',
	'void main() {',
	'	 frag_u_matrix = u_matrix;',
	'    vec3 p = positions[gl_VertexID].xyz;',
	'    near_point = unproject(p.x, p.y, 0.0, u_matrix).xyz;',
	'    far_point = unproject(p.x, p.y, 1.0, u_matrix).xyz;',
	'    gl_Position = vec4(p, 1.0);',
	'}'
].join("\n");

var plane_fragment_shader_source = [
	'#version 300 es',
	'precision highp float;',
	'',
	'in vec3 near_point;',
	'in vec3 far_point;',
	'in mat4 frag_u_matrix;',
	'',
	'out vec4 out_color;',
	'',
	'vec4 grid(vec3 fragPos3D, float scale) {',
	'    vec2 coord = fragPos3D.xz / scale;',
	'    vec2 grid = abs(fract(coord - 0.5) - 0.5);',
	'    float line = min(grid.x, grid.y);',
	'    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);',
	'    if (line < 0.02)',
	'        color = vec4(0.3, 0.3, 0.3, 1.0);',
	'    // z axis',
	'    if (abs(fragPos3D.x) < 0.1)',
	'        color.z = 1.0;',
	'    // x axis',
	'    if (abs(fragPos3D.z) < 0.1)',
	'        color.x = 1.0;',
	'    return color;',
	'}',
	'',
	'float compute_depth(vec3 pos) {',
	'    vec4 clip_pos = frag_u_matrix * vec4(pos, 1.0);',
	'    return clip_pos.z / clip_pos.w;',
	'}',
	'',
	'float compute_linear_depth(vec3 pos) {',
	'    float near = 0.1;',
	'    float far = 100.0;',
	'    vec4 clip_pos = frag_u_matrix * vec4(pos, 1.0);',
	'    float clip_depth = (clip_pos.z / clip_pos.w) * 2.0 - 1.0;',
	'    float linear_depth = (2.0 * near * far) / (far + near - clip_depth * (far - near));',
	'    return linear_depth / far;',
	'}',
	'',
	'void main() {',
	'    float t = -near_point.y / (far_point.y - near_point.y);',
	'    vec3 fragPos3D = near_point + t * (far_point - near_point);',
	'	 gl_FragDepth = compute_depth(fragPos3D);',
	'    float fading = max(0.0, 0.6 - compute_linear_depth(fragPos3D));',
	'    out_color = grid(fragPos3D, 10.0) * float(t > 0.0);',
	'    out_color.a *= fading;',
	'}'
].join("\n");

var skybox_vertex_shader_source = [
	'#version 300 es',
	'precision mediump float;',
	'',
	'const vec3 positions[6] = vec3[](',
	'    vec3(-1, 1, -1),',
	'    vec3(-1, -1, -1),',
	'    vec3(1, -1, -1),',
	'    vec3(1, -1, -1),',
	'    vec3(1, 1, -1),',
	'    vec3(-1, 1, -1)',
	');',
	'',
	'uniform mat4 u_view;',
	'',
	'out vec3 frag_pos;',
	'',
	'void main() {',
	'	 vec3 pos = positions[gl_VertexID];',
	'    frag_pos = (u_view * vec4(pos, 1.0)).xyz;',
	'    gl_Position = vec4(pos, 1.0);',
	'}'
].join("\n");

var skybox_fragment_shader_source = [
	'#version 300 es',
	'precision mediump float;',
	'',
	'in vec3 frag_pos;',
	'out vec4 out_color;',
	'',
	'uniform samplerCube u_skybox;',
	'',
	'void main() {',
	'    out_color = texture(u_skybox, normalize(frag_pos));',
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

	gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);

	gl.enable(gl.DEPTH_TEST);
	// gl.enable(gl.CULL_FACE);
	// gl.frontFace(gl.CCW);
	// gl.cullFace(gl.BACK);

	// gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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

	var plane_u_matrix = gl.getUniformLocation(plane_program, "u_matrix");

	// ###########################
	// testing the skybox code before putting it in the scene
	// ###########################

	var skybox_vertex_shader = compile_shader(gl, gl.VERTEX_SHADER, skybox_vertex_shader_source);
	var skybox_fragment_shader = compile_shader(gl, gl.FRAGMENT_SHADER, skybox_fragment_shader_source);

	var skybox_program = create_program(gl, skybox_vertex_shader, skybox_fragment_shader);

	// var skybox_pos_location = gl.getAttribLocation(skybox_program, "a_pos");
	var skybox_location = gl.getUniformLocation(skybox_program, "u_skybox");
	var skybox_matrix_location = gl.getUniformLocation(skybox_program, "u_view");


	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

	const face_infos = [
		{
			target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
			url: "/skybox/right.png",
		},
		{
			target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
			url: "/skybox/left.png",
		},
		{
			target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
			url: "/skybox/top.png",
		},
		{
			target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
			url: "/skybox/bottom.png",
		},
		{
			target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
			url: "/skybox/front.png",
		},
		{
			target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
			url: "/skybox/back.png",
		},
	];

	var imageCount = 0;
	var totalImages = face_infos.length;

	face_infos.forEach((face_info) => {
		const { target, url } = face_info;

		const level = 0;
		const internalFormat = gl.RGBA;
		const format = gl.RGBA;
		const type = gl.UNSIGNED_BYTE;

		// setup each face so it's immediately renderable
		gl.texImage2D(target, level, internalFormat, 1024, 1024, 0, format, type, null);

		// load the image
		const image = new Image();
		image.src = url;

		console.log(image);

		image.addEventListener('load', function () {
			gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
			gl.texImage2D(target, level, internalFormat, format, type, image);

			imageCount++;

			// Check if all images have been loaded
			if (imageCount === totalImages) {
				gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
				gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			}
		});
	});
	
	//###########################
	// render loop
	//###########################

	var scene = new Scene(gl, canvas.clientHeight, canvas.clientWidth, canvas);
	scene.init_program(scene_vertex_shader_source, scene_fragment_shader_source);

	// temporatry objects for a test sim

	// scene.generate_gravity_sim(3);

	var sphere1 = create_sphere(5.0);
	var vertices1 = sphere1.vertices;
	var normals1 = sphere1.normals;
	var indices1 = sphere1.indices;
	var position1 = [0.0, 0.0, 0.0];
	var rotation_x1 = 0;
	var rotation_y1 = 0;
	var mass1 = 100.0;
	var velocity1 = [0.0, 0.0, 0.0];
	var is_light_source1 = true;

	scene.add_object(vertices1, normals1, indices1, position1, rotation_x1, rotation_y1, mass1, velocity1, is_light_source1);

	var sphere2 = create_sphere(2.0);
	var vertices2 = sphere2.vertices;
	var normals2 = sphere2.normals;
	var indices2 = sphere2.indices;
	var position2 = [30.0, 0.0, 0.0];
	var rotation_x2 = 0;
	var rotation_y2 = 0;
	var mass2 = 1.0;
	var velocity2 = [0.0, 0.0, 0.4];
	var is_light_source2 = false;

	scene.add_object(vertices2, normals2, indices2, position2, rotation_x2, rotation_y2, mass2, velocity2, is_light_source2);

	var cur = 0;
	var prev = 0;
	var dt = 0;

	console.log(gl.getError());

	var render = function (now) {
		// calculate fps
		fpsElem.textContent = compute_average_fps(now).toFixed(1);

		// update dt
		prev = cur;
		cur = performance.now();

		dt = (cur - prev) / 1000;

		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

		var temp_mat = scene.view_matrix.slice();

		temp_mat[12] = 0;
		temp_mat[13] = 0;
		temp_mat[14] = 0;

	
		gl.depthMask(false);
		gl.useProgram(skybox_program);
		gl.uniformMatrix4fv(skybox_matrix_location, false, temp_mat);
		gl.uniform1i(skybox_location, 0);
		gl.depthFunc(gl.LEQUAL);
		gl.drawArrays(gl.TRIANGLES, 0, 36);
		gl.depthMask(true);

		gl.depthMask(false);
		gl.useProgram(plane_program);
		gl.uniformMatrix4fv(plane_u_matrix, false, scene.view_proj_matrix);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.depthMask(true);

		scene.draw_scene();

		requestAnimationFrame(render);
	};
	requestAnimationFrame(render);
}

main();