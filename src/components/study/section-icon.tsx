import {
  BookOpen,
  Compass,
  FlaskConical,
  GitBranch,
  Globe,
  History,
  Languages,
  Layers,
  Lightbulb,
  ListChecks,
  Map,
  Mountain,
  Quote,
  ScrollText,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Icons a lesson section may use (keep in sync with ICONS in scripts/lesson-to-sql.mjs). */
const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  languages: Languages,
  quote: Quote,
  sparkles: Sparkles,
  "flask-conical": FlaskConical,
  "git-branch": GitBranch,
  mountain: Mountain,
  users: Users,
  layers: Layers,
  globe: Globe,
  history: History,
  target: Target,
  lightbulb: Lightbulb,
  "scroll-text": ScrollText,
  compass: Compass,
  map: Map,
  "list-checks": ListChecks,
};

export function SectionIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}
