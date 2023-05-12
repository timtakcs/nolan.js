// Helper functions to avoid boilerplate code

export function resize_canvas(canvas) {
	const displayWidth = canvas.clientWidth;
	const displayHeight = canvas.clientHeight;

	const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;

	if (needResize) {
		canvas.width = displayWidth;
		canvas.height = displayHeight;
	}

	return needResize;
}

/** @param{WebGLRenderingContext} gl */
export function compile_shader(gl, type, source) {
	var shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	var ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (ok) {
		console.log(`Compiled ${type} shader successfully`);
		return shader;
	}

	console.log("Failed to compile shader");
	console.log(gl.getShaderInfoLog(shader));
	gl.deleteShader(shader);
}

/** @param{WebGLRenderingContext} gl */
export function create_program(gl, vertex_shader, fragment_shader) {
	var program = gl.createProgram();
	gl.attachShader(program, vertex_shader);
	gl.attachShader(program, fragment_shader);
	gl.linkProgram(program);

	var ok = gl.getProgramParameter(program, gl.LINK_STATUS);
	if (ok) {
		console.log("Program linked successfully");
		return program;
	}

	console.log("Failed to link program");
	console.log(gl.getProgramInfoLog(program));
	gl.deleteProgram(program);
}

/** @param{WebGLRenderingContext} gl */
export function create_uniform_setters(gl, program) {
    const uniform_setters = {};

    function create_uniform_setter(gl, program, uniform_info) {
        const location = gl.getUniformLocation(program, uniform_info.name);
        const type = uniform_info.type;
        // Check if this uniform is an array
        const isArray = (uniform_info.size > 1 && uniform_info.name.substring(-3) === "[0]");

        if (type === gl.FLOAT && isArray) {
            return function(v) {
                gl.uniform1fv(location, v.data);
            };
        }
        if (type === gl.FLOAT) {
            return function(v) {
                gl.uniform1f(location, v.data);
            };
        }
        if (type === gl.FLOAT_VEC2) {
            return function(v) {
                gl.uniform2fv(location, v.data);
            };
        }
        if (type === gl.FLOAT_VEC3) {
            return function(v) {
                gl.uniform3fv(location, v.data);
            };
        }
        if (type === gl.FLOAT_VEC4) {
            return function(v) {
                gl.uniform4fv(location, v.data);
            };
        }
        if (type === gl.INT && isArray) {
            return function(v) {
                gl.uniform1iv(location, v.data);
            };
        }
        if (type === gl.INT) {
            return function(v) {
                gl.uniform1i(location, v.data);
            };
        }
        if (type === gl.INT_VEC2) {
            return function(v) {
                gl.uniform2iv(location, v.data);
            };
        }
        if (type === gl.INT_VEC3) {
            return function(v) {
                gl.uniform3iv(location, v.data);
            };
        }
        if (type === gl.INT_VEC4) {
            return function(v) {
                gl.uniform4iv(location, v.data);
            };
        }
        if (type === gl.BOOL) {
            return function(v) {
                gl.uniform1iv(location, v.data);
            };
        }
        if (type === gl.BOOL_VEC2) {
            return function(v) {
                gl.uniform2iv(location, v.data);
            };
        }
        if (type === gl.BOOL_VEC3) {
            return function(v) {
                gl.uniform3iv(location, v.data);
            };
        }
        if (type === gl.BOOL_VEC4) {
            return function(v) {
                gl.uniform4iv(location, v.data);
            };
        }
        if (type === gl.FLOAT && isArray) {
            return function(v) {
                gl.uniform1fv(location, v.data);
            };
        }
        if (type === gl.FLOAT_MAT2) {
            return function(v) {
                gl.uniformMatrix2fv(location, false, v.data);
            };
        }
        if (type === gl.FLOAT_MAT3) {
            return function(v) {
                gl.uniformMatrix3fv(location, false, v.data);
            };
        }
        if (type === gl.FLOAT_MAT4) {
            return function(v) {
                gl.uniformMatrix4fv(location, false, v.data);
            };
        }
    }

    const num_uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < num_uniforms; ++i) {
        const uniform_info = gl.getActiveUniform(program, i);
        if (!uniform_info) {
            console.log("Failed to get uniform info at index " + i);
            break;
        }
        uniform_setters[uniform_info.name] = create_uniform_setter(gl, program, uniform_info);
    }

    return uniform_setters;
}

/** @param{WebGLRenderingContext} gl */
export function create_attribute_setters(gl, program) {
    const attribute_setters = {};

    function create_attrib_setter(gl, index) {
        return function(b) {
            gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
            gl.enableVertexAttribArray(index);
            gl.vertexAttribPointer(
                index,
                b.num_components || b.size,
                b.type || gl.FLOAT,
                b.normalize || false,
                b.stride || 0,
                b.offset || 0
            );
        };
    }

    const num_attribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < num_attribs; ++i) {
        const attrib_info = gl.getActiveAttrib(program, i);
        if (!attrib_info) {
            console.log("Failed to get attribute info at index " + i);
            break;
        }
        const index = gl.getAttribLocation(program, attrib_info.name);
        attribute_setters[attrib_info.name] = create_attrib_setter(gl, index);
    }

    return attribute_setters;
}

/** @param{WebGLRenderingContext} gl */
export function create_buffer_info_from_arrays(gl, arrays) {
    function create_buffer_from_array(gl, array, type) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(type, buffer);
        
        // checking the type of the array and using the appropriate bufferData
        if (array.data instanceof Float32Array) {
            gl.bufferData(type, array.data, gl.STATIC_DRAW); 
        } else if (array instanceof Uint16Array) {
            gl.bufferData(type, array.data, gl.STATIC_DRAW);
        }
        return buffer;
    }

    function create_attribs_from_arrays(gl, arrays) {
        const attribs = {};
        Object.keys(arrays).forEach(function(name) {
            if (name === "indices") {
                return;
            }
            const array = arrays[name];
            attribs[name] = {
                buffer: create_buffer_from_array(gl, array, gl.ARRAY_BUFFER),
                num_components: array.size,
                type: gl.FLOAT, // temporary, needs to be generalized
                normalize: false, // temporary, needs to be generalized
                stride: 0,
                offset: 0,
            };
        });
        return attribs;
    }

    function get_num_elements_from_non_indexed_arrays(arrays) {
        let key = Object.keys(arrays)[0];
        return arrays[key].length / arrays[key].num_components;
    }

    const buffer_info = {
        attribs: create_attribs_from_arrays(gl, arrays),
    };

    const indices = arrays.indices;

    if (indices) {
        buffer_info.num_elements = indices.length;
        buffer_info.indices = create_buffer_from_array(gl, indices, gl.ELEMENT_ARRAY_BUFFER);
    } else {
        buffer_info.num_elements = get_num_elements_from_non_indexed_arrays(arrays);
    }

    return buffer_info;
}

/** @param{WebGLRenderingContext} gl */
export function set_buffers_and_attributes(gl, setters, buffers) {
    Object.keys(buffers.attribs).forEach(function(name) {
        const setter = setters[name];
        if (setter) {
            setter(buffers.attribs[name]);
        }
    });
    if (buffers.indices) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    }
}

/** @param{WebGLRenderingContext} gl */
export function set_uniforms(setters, values) {
    Object.keys(values).forEach(function(name) {
        const setter = setters[name];
        if (setter) {
            setter(values[name]);
        }
    });
}