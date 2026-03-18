import { useState } from "react";
import { GameScreen } from "@/screens/GameScreen";
import { MenuScreen } from "@/screens/MenuScreen";

type Screen = "menu" | "game";

function App() {
  const [screen, setScreen] = useState<Screen>("menu");

  if (screen === "menu") {
    return <MenuScreen onStartGame={() => setScreen("game")} />;
  }

  return <GameScreen onBack={() => setScreen("menu")} />;
}

export default App;
