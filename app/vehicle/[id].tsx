import { Text, Button } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useVehicle } from "../../src/presentation/hooks/useVehicle";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";

export default function VehicleDetails() {
    const { id } = useLocalSearchParams<{ id: string }>();

    if (!id) {
        return (
            <SafeAreaView style={{ flex: 1, padding: 16 }}>
                <Text>Missing vehicle id</Text>
            </SafeAreaView>
        );
    }

    const { vehicle, loading, error } = useVehicle(id);
    const { isAuthenticated } = useAuthStatus();

    return (
        <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
            {loading && <Text>Loading...</Text>}
            {error && <Text>Error: {error}</Text>}

            {vehicle && (
                <>
                    <Text style={{ fontSize: 22, fontWeight: "700" }}>{vehicle.title}</Text>
                    <Text>
                        {vehicle.city} • {vehicle.pricePerDay} MAD/jour
                    </Text>
                    <Text>ID: {vehicle._id}</Text>

                    <Button
                        title="Réserver"
                        onPress={() => {
                            if (!ensureAuth(isAuthenticated)) return;
                            router.push(`/reservation/${id}`);
                        }}
                    />
                </>
            )}

            {!loading && !error && !vehicle && <Text>Vehicle not found</Text>}
        </SafeAreaView>
    );
}
