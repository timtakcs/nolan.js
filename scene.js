import { Camera } from "./camera.js";
import { InputManager } from "./input_manager.js";

const { mat2, mat2d, mat4, mat3, quat, quat2, vec2, vec3, vec4 } = glMatrix;

import {
	create_program, resize_canvas, compile_shader,
	create_attribute_setters, create_uniform_setters,
	create_buffer_info_from_arrays,
	set_buffers_and_attributes, set_uniforms
} from "./webgl_helpers.js"; // this include is disgusting fix it later

export class Scene {
    constructor(gl, viewport_h, viewport_w, canvas) {
        this.gl = gl;
        this.program = null;
        this.objects = [];
        this.camera = new Camera(viewport_h, viewport_w);
        this.input_manager = new InputManager(canvas);
        this.canvas = canvas;

        this.camera_matrix = mat4.create();
        this.view_matrix = mat4.create();
        this.proj_matrix = mat4.create();
        this.view_proj_matrix = mat4.create();

        //temporary static things that will be made dynamic later
        this.uniform_reverse_light = [0.5, 0.0, 1.0];
    }

    get_random_rgb_value() {
        return [Math.random(), Math.random(), Math.random(), 1.0];
    }

    to_radians(degrees) {
        return degrees * Math.PI / 180;
    }

    compute_matrix_for_scene_object(view_proj_matrix, translation, rotation_x, rotation_y) {
		var matrix = mat4.create();

		mat4.translate(matrix, matrix, translation);
		mat4.rotateX(matrix, matrix, rotation_x);
		mat4.rotateY(matrix, matrix, rotation_y);
		mat4.multiply(matrix, view_proj_matrix, matrix);

		return matrix;
	}

    init_program(vertex_shader_source, fragment_shader_source) {
        var vertex_shader = compile_shader(this.gl, this.gl.VERTEX_SHADER, vertex_shader_source);
        var fragment_shader = compile_shader(this.gl, this.gl.FRAGMENT_SHADER, fragment_shader_source);

        this.program = create_program(this.gl, vertex_shader, fragment_shader);
        this.gl.useProgram(this.program);
    }

    draw_object(obj, attribute_setters, uniform_setters) {
        obj.uniforms.u_matrix.data = this.compute_matrix_for_scene_object(this.view_proj_matrix, obj.translation, obj.rotation_x, obj.rotation_y);

        set_buffers_and_attributes(this.gl, attribute_setters, obj.buffer_info);
        set_uniforms(uniform_setters, obj.uniforms);

        if (obj.use_indices) {
            this.gl.drawElements(this.gl.TRIANGLES, obj.buffer_info.num_elements, this.gl.UNSIGNED_SHORT, 0);
        } else {
            this.gl.drawArrays(this.gl.TRIANGLES, 0, 18);
        }
    }

    draw_scene() {

        var attribute_setters = create_attribute_setters(this.gl, this.program);
        var uniform_setters = create_uniform_setters(this.gl, this.program);

        var direction = this.camera.get_direction();

        var movement = this.input_manager.get_move_vector();
		var wheel = this.input_manager.get_wheel_vector(direction);

        mat4.perspective(this.proj_matrix, this.to_radians(45), this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000.0);
		mat4.lookAt(this.camera_matrix, this.camera.pos, this.camera.look_at, [0, 1, 0]);
		mat4.invert(this.view_matrix, this.camera_matrix);
		mat4.mul(this.view_proj_matrix, this.proj_matrix, this.camera_matrix);

        this.camera.transform(movement, wheel, this.view_matrix);

        for (var i = 0; i < this.objects.length; i++) {
            this.draw_object(this.objects[i], attribute_setters, uniform_setters);
        }
    }

    add_object(vertices, normals, indices, translation, rotation_x, rotation_y) {
        var attributes = {
            pos: { size: 3, data: new Float32Array(vertices) },
            normal: { size: 3, data: new Float32Array(normals) },
            indices: { size: 1, data: new Uint16Array(indices) },
        };

        var object_buffer_info = create_buffer_info_from_arrays(this.gl, attributes);

        var object_uniforms = {
            u_matrix: { data: mat4.create()},
            u_reverse_light: { data: new Float32Array(this.uniform_reverse_light) },
            u_color: { data: new Float32Array(this.get_random_rgb_value()) },
            u_world_matrix: { data: mat4.create() },
        };

        console.log(indices);

        var obj = {
            uniforms: object_uniforms,
            buffer_info: object_buffer_info,

            translation: translation,
            rotation_x: rotation_x,
            rotation_y: rotation_y,
            
            use_indices: (indices.length === 0) ? false : true,
        };

        this.objects.push(obj);
    }
}