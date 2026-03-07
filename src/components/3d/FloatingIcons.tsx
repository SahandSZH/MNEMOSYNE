import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FloatingIcon = ({
  position,
  color,
  speed,
  shape,
}: {
  position: [number, number, number];
  color: string;
  speed: number;
  shape: "torus" | "octahedron" | "dodecahedron" | "icosahedron";
}) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.3;
      ref.current.rotation.x += 0.005;
      ref.current.rotation.z += 0.003;
    }
  });

  const renderGeometry = () => {
    switch (shape) {
      case "torus":
        return <torusGeometry args={[0.2, 0.06, 12, 24]} />;
      case "octahedron":
        return <octahedronGeometry args={[0.2]} />;
      case "dodecahedron":
        return <dodecahedronGeometry args={[0.18]} />;
      case "icosahedron":
        return <icosahedronGeometry args={[0.2]} />;
    }
  };

  return (
    <mesh ref={ref} position={position}>
      {renderGeometry()}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        transparent
        opacity={0.7}
        wireframe
      />
    </mesh>
  );
};

const FloatingIcons = () => {
  return (
    <group>
      {/* Heart monitor - torus */}
      <FloatingIcon position={[3, 1.5, 1]} color="#4dd8e0" speed={0.6} shape="torus" />
      {/* Clipboard - octahedron */}
      <FloatingIcon position={[-3, 1, 1.5]} color="#6c8cff" speed={0.8} shape="octahedron" />
      {/* Neural node - dodecahedron */}
      <FloatingIcon position={[1, 2, -2]} color="#a78bfa" speed={0.5} shape="dodecahedron" />
      {/* DNA marker - icosahedron */}
      <FloatingIcon position={[-1.5, -0.5, 2]} color="#34d399" speed={0.7} shape="icosahedron" />
      {/* Extra nodes */}
      <FloatingIcon position={[0, 2.5, -1]} color="#4dd8e0" speed={0.4} shape="torus" />
      <FloatingIcon position={[-2.5, -1, -1.5]} color="#6c8cff" speed={0.55} shape="icosahedron" />
    </group>
  );
};

export default FloatingIcons;
