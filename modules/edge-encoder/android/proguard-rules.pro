# ONNX Runtime's native library looks up its Java classes by name (JNI FindClass), so R8 must neither
# remove nor rename them (release build of 2026-10-09: ClassNotFoundException ai.onnxruntime.TensorInfo).
-keep class ai.onnxruntime.** { *; }
