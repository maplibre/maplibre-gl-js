#ifdef GL_ES
precision mediump float;
#else

#if !defined(lowp)
#define lowp
#endif

#if !defined(mediump)
#define mediump
#endif

#if !defined(highp)
#define highp
#endif

#endif

#ifdef OPACITY_MRT
layout(location = 0) out highp vec4 fragColor;
#else
out highp vec4 fragColor;
#endif
