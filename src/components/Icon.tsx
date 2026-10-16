import {
  Utensils, Coffee, ShoppingBag, Theater, HeartHandshake, Landmark, Train, Trees, BedDouble, Cpu, Music, Palette, Baby, Bike, ChefHat, Users,
  GraduationCap, PartyPopper, Dumbbell, Drama, HandHeart, Lamp, SprayCan, Footprints, CircleDot, Construction, Armchair, MapPin, Briefcase, Skull, TriangleAlert, ShieldAlert, Megaphone, Flashlight, LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  utensils: Utensils, coffee: Coffee, 'shopping-bag': ShoppingBag, theater: Theater, 'heart-handshake': HeartHandshake, landmark: Landmark,
  train: Train, trees: Trees, bed: BedDouble, cpu: Cpu, music: Music, palette: Palette, baby: Baby, bike: Bike, 'chef-hat': ChefHat, users: Users,
  'graduation-cap': GraduationCap, 'party-popper': PartyPopper, dumbbell: Dumbbell, drama: Drama, 'hand-heart': HandHeart, lamp: Lamp,
  'spray-can': SprayCan, footprints: Footprints, 'circle-dot': CircleDot, construction: Construction, armchair: Armchair, briefcase: Briefcase, skull: Skull, 'triangle-alert': TriangleAlert, 'shield-alert': ShieldAlert, megaphone: Megaphone, flashlight: Flashlight,
};

export function Icon({ name, size = 18, strokeWidth = 2.2, className }: { name: string; size?: number; strokeWidth?: number; className?: string }) {
  const C = MAP[name] ?? MapPin;
  return <C size={size} strokeWidth={strokeWidth} className={className} />;
}
