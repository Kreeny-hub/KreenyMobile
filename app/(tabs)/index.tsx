import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";

const ONBOARDING_KEY = "kreeny_onboarding_seen";

export default function TabsIndex() {
  const [checked, setChecked] = useState(false);
  const [seen, setSeen] = useState(true); // default true to avoid flash

  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_KEY).then((val) => {
      setSeen(val === "true");
      setChecked(true);
    }).catch(() => setChecked(true));
  }, []);

  if (!checked) return null;
  if (!seen) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}