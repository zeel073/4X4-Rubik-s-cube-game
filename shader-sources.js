const VERT_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec3 aColor;
  uniform mat4 uProjection;
  uniform mat4 uView;
  varying vec3 vColor;
  varying vec3 vNormal;
  void main() {
    vec4 worldPos = vec4(aPosition, 1.0);
    vNormal = normalize(aNormal);
    vColor = aColor;
    gl_Position = uProjection * uView * worldPos;
  }
`;

const FRAG_SOURCE = `
  precision mediump float;
  varying vec3 vColor;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 l1 = normalize(vec3(0.62, 0.77, 0.18));
    vec3 l2 = normalize(vec3(-0.51, -0.35, -0.78));
    float d1 = max(dot(n, l1), 0.0);
    float d2 = max(dot(n, l2), 0.0);
    float ambient = 0.36;
    float shade = ambient + d1 * 0.58 + d2 * 0.16;
    gl_FragColor = vec4(vColor * shade, 1.0);
  }
`;

window.RubikShaders = { VERT_SOURCE, FRAG_SOURCE };

