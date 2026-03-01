import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KText, KRow, KVStack, KPressable, KDivider, createStyles } from "../../src/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <KVStack gap="sm" style={{ marginBottom: 24 }}>
      <KText variant="label" bold style={{ fontSize: 15 }}>{title}</KText>
      {children}
    </KVStack>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <KText variant="body" color="textSecondary" style={{ lineHeight: 22 }}>{children}</KText>;
}

export default function PrivacyScreen() {
  const { styles, colors } = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KRow gap={8} style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <KText variant="label" bold style={{ fontSize: 17 }}>Politique de confidentialité</KText>
      </KRow>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
        <KText variant="caption" color="textTertiary" style={{ marginBottom: 20 }}>
          Dernière mise à jour : février 2026
        </KText>

        <Section title="1. Responsable du traitement">
          <P>Kreeny SARL, dont le siège social est situé à Casablanca, Maroc, est responsable du traitement de vos données personnelles conformément à la loi marocaine n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel.</P>
        </Section>

        <Section title="2. Données collectées">
          <P>Nous collectons les données suivantes lors de votre utilisation de Kreeny :</P>
          <P>• Données d'identité : nom, prénom, adresse email, numéro de téléphone{"\n"}• Données de vérification : photo de profil, pièce d'identité (KYC){"\n"}• Données véhicule : photos, caractéristiques, localisation{"\n"}• Données de transaction : historique des réservations, paiements{"\n"}• Données techniques : token de notification push, type d'appareil{"\n"}• Données d'usage : messages échangés, constats d'état, avis</P>
        </Section>

        <Section title="3. Finalité du traitement">
          <P>Vos données sont utilisées pour : permettre la mise en relation propriétaire-locataire, sécuriser les transactions, envoyer des notifications relatives à vos réservations, améliorer nos services, et respecter nos obligations légales.</P>
        </Section>

        <Section title="4. Base légale">
          <P>Le traitement de vos données repose sur : l'exécution du contrat de service (réservation, paiement), votre consentement (notifications push, photos), et notre intérêt légitime (prévention de la fraude, amélioration du service).</P>
        </Section>

        <Section title="5. Partage des données">
          <P>Vos données ne sont jamais vendues à des tiers. Elles peuvent être partagées avec : l'autre partie d'une réservation (nom, photo, téléphone pour le rendez-vous), nos prestataires techniques (hébergement, paiement), et les autorités compétentes sur demande légale.</P>
        </Section>

        <Section title="6. Durée de conservation">
          <P>Vos données sont conservées pendant la durée de votre compte, puis 3 ans après la suppression à des fins comptables et légales. Les constats d'état sont conservés 1 an après la fin de la location. Les messages sont conservés 6 mois après la fin de la réservation associée.</P>
        </Section>

        <Section title="7. Sécurité">
          <P>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement des communications (TLS), stockage sécurisé des données, authentification renforcée, et accès restreint aux données personnelles.</P>
        </Section>

        <Section title="8. Vos droits">
          <P>Conformément à la loi 09-08, vous disposez des droits suivants : droit d'accès, droit de rectification, droit de suppression, droit d'opposition, et droit à la portabilité de vos données.</P>
          <P>Pour exercer ces droits, contactez-nous à privacy@kreeny.ma ou via l'application (Profil → Paramètres → Contacter le support).</P>
        </Section>

        <Section title="9. Cookies et trackers">
          <P>L'application mobile Kreeny n'utilise pas de cookies. Des identifiants techniques (token push, identifiant de session) sont utilisés pour le fonctionnement normal du service.</P>
        </Section>

        <Section title="10. Modifications">
          <P>Cette politique peut être modifiée. En cas de changement substantiel, vous serez informé via l'application. La date de dernière mise à jour est indiquée en haut de ce document.</P>
        </Section>

        <Section title="11. Contact CNDP">
          <P>Vous pouvez adresser toute réclamation à la Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP) — www.cndp.ma</P>
        </Section>

        <KDivider style={{ marginVertical: 16 }} />
        <KText variant="caption" color="textTertiary" style={{ textAlign: "center" }}>
          Kreeny SARL — Casablanca, Maroc{"\n"}privacy@kreeny.ma
        </KText>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: {
    paddingHorizontal: 14, paddingVertical: 10, alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
  },
}));
