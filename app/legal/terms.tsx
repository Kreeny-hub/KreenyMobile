import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KText, KRow, KVStack, KPressable, KDivider, createStyles } from "../../src/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { styles } = useStyles();
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

export default function TermsScreen() {
  const { styles, colors } = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KRow gap={8} style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <KText variant="label" bold style={{ fontSize: 17 }}>Conditions d'utilisation</KText>
      </KRow>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
        <KText variant="caption" color="textTertiary" style={{ marginBottom: 20 }}>
          Dernière mise à jour : février 2026
        </KText>

        <Section title="1. Objet">
          <P>Kreeny est une plateforme de mise en relation entre propriétaires de véhicules et locataires au Maroc. Les présentes conditions régissent l'utilisation de l'application mobile Kreeny et de tous les services associés.</P>
        </Section>

        <Section title="2. Inscription et compte">
          <P>L'inscription est gratuite et ouverte à toute personne physique majeure (18 ans révolus) résidant au Maroc. L'utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants de connexion.</P>
          <P>Kreeny se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes conditions.</P>
        </Section>

        <Section title="3. Rôle de la plateforme">
          <P>Kreeny agit en tant qu'intermédiaire technique. La plateforme n'est ni propriétaire ni locataire des véhicules. Le contrat de location est conclu directement entre le propriétaire et le locataire.</P>
          <P>Kreeny facilite la transaction (paiement sécurisé, messagerie, constat d'état) mais ne saurait être tenue responsable des dommages résultant de la location.</P>
        </Section>

        <Section title="4. Obligations du propriétaire">
          <P>Le propriétaire s'engage à proposer un véhicule en bon état de fonctionnement, assuré, avec un contrôle technique valide. Il garantit être le propriétaire légitime ou disposer d'un mandat de mise en location.</P>
          <P>Le véhicule doit correspondre à la description et aux photos publiées sur l'annonce. Toute information trompeuse peut entraîner la suspension du compte.</P>
        </Section>

        <Section title="5. Obligations du locataire">
          <P>Le locataire doit être titulaire d'un permis de conduire valide au Maroc. Il s'engage à utiliser le véhicule de manière responsable, à respecter le code de la route et à restituer le véhicule dans l'état dans lequel il l'a reçu.</P>
          <P>La sous-location du véhicule est strictement interdite.</P>
        </Section>

        <Section title="6. Réservation et paiement">
          <P>La réservation est effective après acceptation par le propriétaire et paiement par le locataire via la plateforme. Le paiement s'effectue exclusivement via les moyens proposés par Kreeny.</P>
          <P>Tout paiement en dehors de la plateforme prive les parties de la protection offerte par Kreeny.</P>
        </Section>

        <Section title="7. Politique d'annulation">
          <P>La politique d'annulation Modérée s'applique à toutes les réservations : annulation gratuite jusqu'à 3 jours avant le départ, remboursement de 50% entre 3 jours et 24 heures avant, aucun remboursement en deçà de 24 heures.</P>
          <P>En cas d'annulation par le propriétaire, le locataire bénéficie d'un remboursement intégral.</P>
        </Section>

        <Section title="8. Constat d'état">
          <P>Un constat photographique est obligatoire au départ et au retour du véhicule. Les deux parties doivent soumettre leurs photos via l'application. Ce constat fait foi en cas de litige.</P>
        </Section>

        <Section title="9. Caution">
          <P>Une empreinte bancaire (caution) peut être requise. Elle n'est pas débitée sauf en cas de dommages constatés au retour. Le montant de la caution est indiqué sur l'annonce.</P>
        </Section>

        <Section title="10. Assurance">
          <P>Le propriétaire est responsable de l'assurance du véhicule. Le locataire doit vérifier que l'assurance couvre la location entre particuliers. Kreeny recommande fortement de souscrire une assurance complémentaire.</P>
        </Section>

        <Section title="11. Litiges">
          <P>En cas de litige, les parties s'engagent à privilégier une résolution amiable via le support Kreeny. À défaut, les tribunaux compétents du Royaume du Maroc seront saisis conformément au droit marocain.</P>
        </Section>

        <Section title="12. Propriété intellectuelle">
          <P>L'application Kreeny, son design, son code et son contenu sont la propriété exclusive de Kreeny SARL. Toute reproduction est interdite sans autorisation préalable.</P>
        </Section>

        <Section title="13. Modification des conditions">
          <P>Kreeny se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés de toute modification substantielle. L'utilisation continue de l'application vaut acceptation des nouvelles conditions.</P>
        </Section>

        <KDivider style={{ marginVertical: 16 }} />
        <KText variant="caption" color="textTertiary" style={{ textAlign: "center" }}>
          Kreeny SARL — Casablanca, Maroc{"\n"}contact@kreeny.ma
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
