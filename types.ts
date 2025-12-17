
export enum GameScreen {
  TITLE = 'TITLE',
  LOGIN = 'LOGIN',
  INSTRUCTIONS = 'INSTRUCTIONS',
  CHAR_SELECT = 'CHAR_SELECT',
  MAP = 'MAP',
  GAMEPLAY = 'GAMEPLAY',
  RESULT = 'RESULT'
}

export enum Category {
  MATH = 'Matematika Dasar',
  HISTORY_INDO = 'Sejarah Indonesia',
  JAVA_KRAMA = 'Bahasa Jawa Krama Inggil',
  PRESIDENTS = 'Nama Presiden Indonesia',
  CAPITALS = 'Ibu Kota Negara Dunia',
  WAYANG = 'Tokoh Pewayangan',
  ENGLISH = 'Bahasa Inggris Dasar',
  PROPHET = 'Sejarah Nabi Muhammad',
  SCIENCE = 'Sains Dasar',
  HOUSES = 'Rumah Adat Indonesia',
  TRIBES = 'Suku di Indonesia',
  DANCES = 'Tari di Indonesia'
}

export interface User {
  name: string;
  grade: string;
  characterId: string;
  scores: Record<string, number>; // Category -> Score
}

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  imageUrl?: string;
  imagePrompt?: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  image: string; // URL placeholder
  description: string;
}

export const CHARACTERS: Character[] = [
  {
    id: 'kelly',
    name: 'SWIFT',
    role: 'Sprinter',
    image: 'https://picsum.photos/200/300?random=1',
    description: 'Kecepatan lari meningkat 10%.'
  },
  {
    id: 'andrew',
    name: 'VETERAN',
    role: 'Police',
    image: 'https://picsum.photos/200/300?random=2',
    description: 'Daya tahan vest meningkat.'
  },
  {
    id: 'moco',
    name: 'HACKER',
    role: 'Tech',
    image: 'https://picsum.photos/200/300?random=3',
    description: 'Menandai musuh yang ditembak.'
  },
  {
    id: 'maxim',
    name: 'GLUTTON',
    role: 'Eater',
    image: 'https://picsum.photos/200/300?random=4',
    description: 'Memakan jamur lebih cepat.'
  }
];
