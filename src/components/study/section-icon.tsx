import {
  Bird, BookOpen, BookText, Brain, Building2, CalendarClock, CircleHelp, Clock, Cloud, CloudRain, Coins, Compass,
  Droplets, Earth, Eye, Factory, FileText, Fish, FlaskConical, GitBranch, Globe, History, Hourglass, Landmark,
  Languages, Layers, Leaf, Lightbulb, ListChecks, Map, MapPin, Microscope, Mountain, MountainSnow, Palette,
  PenLine, Pickaxe, Quote, Route, Ruler, Scale, ScanSearch, ScrollText, Search, Ship, Sparkles, Sprout, Sun,
  Target, TentTree, ThermometerSun, Tractor, Trees, Users, Waves, Wind,
  type LucideIcon,
} from "lucide-react";

/** Icons lessons may use. Keep in sync with src/lib/icon-names.json (validated by scripts/lesson-to-sql.mjs). */
const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen, "book-text": BookText, languages: Languages, quote: Quote, sparkles: Sparkles,
  "flask-conical": FlaskConical, microscope: Microscope, "git-branch": GitBranch, mountain: Mountain,
  "mountain-snow": MountainSnow, users: Users, layers: Layers, globe: Globe, earth: Earth, history: History,
  hourglass: Hourglass, "calendar-clock": CalendarClock, target: Target, lightbulb: Lightbulb, brain: Brain,
  "scroll-text": ScrollText, "file-text": FileText, "pen-line": PenLine, compass: Compass, map: Map,
  "map-pin": MapPin, route: Route, "list-checks": ListChecks, droplets: Droplets, waves: Waves, wind: Wind,
  cloud: Cloud, "cloud-rain": CloudRain, sun: Sun, "thermometer-sun": ThermometerSun, leaf: Leaf,
  sprout: Sprout, trees: Trees, "tent-tree": TentTree, fish: Fish, bird: Bird, "building-2": Building2,
  landmark: Landmark, factory: Factory, tractor: Tractor, pickaxe: Pickaxe, ship: Ship, coins: Coins,
  palette: Palette, scale: Scale, eye: Eye, "scan-search": ScanSearch, search: Search, ruler: Ruler,
  clock: Clock, "circle-help": CircleHelp,
};

export function SectionIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}
