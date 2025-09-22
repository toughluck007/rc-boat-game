Evan Wallace
I created http://madebyevan.com/webgl-water/ back in 2011 and I’ve always been meaning to explain how it works. The most interesting aspect of the demo in my opinion is my approach to rendering caustics. The term “caustic” refers to the pattern that light makes when it is reflected or refracted by a curved surface. Caustics look like this:


Caustics from the sun on the pool floor
This is normally beyond the reach of realtime graphics because the magnitude of the computation required is immense in the general case. It’s very hard to tell what light has arrived at a given point if the light is arriving from many different directions. The general approach is to bounce rays of light everywhere for a while and let them accumulate, then see where they have collected. This is known as path tracing. Light that has been focused on a smaller area accumulates more and gets brighter (recall how a magnifying glass concentrates light into a bright spot) and light that has been spread out gets dimmer.


Path tracing isn’t specific to caustics; it’s a general solution for simulating how light behaves and for rendering realistic images. There are some realtime methods that approximate this in certain cases but those rely on the fact that indirect illumination in diffuse environments usually changes slowly along a surface, in which case you can get away with sparse sampling. This is not the case for caustics at all. Caustics create intricate light patterns with sharp creases that will be blurred and may even be lost completely when using these realtime approximations.

Get Evan Wallace’s stories in your inbox


Join Medium for free to get updates from this writer.

A better approach is to approximate a wavefront of the light using a mesh. Each vertex of the mesh represents a ray of light leaving the light source and landing somewhere in the scene. Each triangle of the mesh approximates all possible light rays between the vertices of the triangle. An increase in the area of the triangle means the light has been spread out and must be dimmed. An area decrease means the light has been focused and should be brighter. The brightness change is proportional to the ratio of the original area to the final area. Representing area directly instead of sampling it avoids needing a massive number of samples to clearly resolve caustic shapes and so is much more efficient. This approach only works in certain cases but it’s perfect for caustics due to the refraction of light through a planar body of water.


This technique is especially convenient because it maps very efficiently to rasterization hardware. Normally the area computation could be done on the GPU using a geometry shader since geometry shaders have simultaneous access to all three vertices in a triangle, but WebGL only supports vertex and fragment shaders. Vertex shaders only look at a single vertex so a standard vertex shader doesn’t have enough information. You could bloat your vertex format to also include the other two vertices in the triangle and have each vertex shader transform all three vertices to determine the area of the triangle, but this means you can no longer share vertices between adjacent triangles in the mesh. There’s a better way.

It’s actually possible to compute the ratio of the original and final triangle areas without ever needing the vertex locations. Fragment shaders have an interesting evaluation strategy: they are always evaluated four-at-a-time in a 2x2 group (see this post for details). Since all fragment shaders in this group share the same instruction pointer, each one can compute the instantaneous screen-space partial derivative along the x and y axes of any value using finite differencing between itself and the neighboring fragment shader along that axis. This is usually used to compute the texture mipmap level but we can use that here to get the area ratio. All the vertex shader needs to do is pass the old and new vertex positions as varying values to the fragment shader.


GLSL code for the area ratio
That’s all you need for realtime caustics! The vertex shader in the demo positions the vertices by tracing a ray for that vertex along the sunlight direction, refracting it through the surface, and intersecting it with the ground geometry. The same technique can be used for computing the caustics due to reflection off the top of the water’s surface (a ray hitting the surface of the water both reflects and transmits light). My demo uses a few more tricks like rendering the caustics to a texture that can then be draped over the scene, but that’s optional and not fundamental to the approach.
