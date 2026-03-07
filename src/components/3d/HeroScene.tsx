import { Suspense, lazy } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const BrainModel = lazy(() => import("./BrainModel"));
const ClinicModel = lazy(() => import("./ClinicModel"));
const FloatingIcons = lazy(() => import("./FloatingIcons"));
const ParticleField = lazy(() => import("./ParticleField"));
const NeuralNetwork = lazy(() => import("./NeuralNetwork"));
const ClinicalBackground = lazy(() => import("./ClinicalBackground"));

const SceneContent = () => (
  <>
    {/* Lighting */}
    <ambientLight intensity={0.3} />
    <directionalLight position={[5, 5, 5]} intensity={0.4} color="#ffffff" />
    <pointLight position={[-3, 2, 2]} intensity={0.3} color="#4dd8e0" />
    <pointLight position={[3, -1, -2]} intensity={0.2} color="#6c8cff" />

    {/* Scene elements */}
    <ClinicalBackground />
    <NeuralNetwork />
    <ParticleField />
    <BrainModel />
    <ClinicModel />
    <FloatingIcons />

    {/* Camera controls */}
    <OrbitControls
      enableZoom={false}
      enablePan={false}
      autoRotate
      autoRotateSpeed={0.3}
      maxPolarAngle={Math.PI / 1.8}
      minPolarAngle={Math.PI / 3}
    />
  </>
);

const HeroScene = () => {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 1, 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default HeroScene;
