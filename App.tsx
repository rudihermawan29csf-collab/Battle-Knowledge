import React, { useState, useEffect } from 'react';
import { GameScreen, Category, User, Question, Character, CHARACTERS } from './types';
import { audioService } from './services/audioService';
import { generateQuestions } from './services/geminiService';
import Cursor from './components/Cursor';
import { LogOut, Crosshair, Zap, Book, Flag, Globe, Music, FlaskConical, Swords, User as UserIcon, Scan } from 'lucide-react';

const STORAGE_KEY = 'battle-knowledge-user';

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

function App() {
  const [screen, setScreen] = useState<GameScreen>(GameScreen.TITLE);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  
  const [questionsP1, setQuestionsP1] = useState<Question[]>([]);
  const [questionsP2, setQuestionsP2] = useState<Question[]>([]);
  const [indexP1, setIndexP1] = useState(0);
  const [indexP2, setIndexP2] = useState(0);
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [finishedP1, setFinishedP1] = useState(false);
  const [finishedP2, setFinishedP2] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [mathSub, setMathSub] = useState<string | null>(null);
  const [showMathModal, setShowMathModal] = useState(false);

  useEffect(() => {
    audioService.playTheme(screen);
  }, [screen]);

  useEffect(() => {
    if (screen === GameScreen.GAMEPLAY && finishedP1 && finishedP2) {
      finishQuiz();
    }
  }, [finishedP1, finishedP2, screen]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch (e) { console.error(e); }
  }, []);

  const saveUser = (updatedUser: User) => {
    try {
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    } catch (e) { console.error(e); }
  };

  const handleStart = () => {
    audioService.resume();
    audioService.playClick();
    if (user) setScreen(GameScreen.MAP);
    else setScreen(GameScreen.LOGIN);
  };

  const handleLogin = (name: string, grade: string) => {
    audioService.playClick();
    const newUser: User = { name, grade, characterId: CHARACTERS[0].id, scores: {} };
    saveUser(newUser);
    setScreen(GameScreen.INSTRUCTIONS);
  };

  const handleCharacterSelect = (charId: string) => {
    audioService.playClick();
    if (user) {
      saveUser({ ...user, characterId: charId });
      setScreen(GameScreen.MAP);
    }
  };

  const startQuiz = async (category: Category, subTopic: string | null = null) => {
    audioService.playClick();
    setLoading(true);
    setLoadingPhase("INITIALIZING LINK TO SATELLITE...");
    setSelectedCategory(category);
    setMathSub(subTopic);
    
    try {
      setLoadingPhase("SCRAPING INTELLIGENCE DATA...");
      const qs = await generateQuestions(category, subTopic, 10);
      
      if (!qs || qs.length === 0) {
        throw new Error("EMPTY INTEL: Satellite returned no usable data.");
      }

      setLoadingPhase("GENERATING TACTICAL VISUALS...");
      setQuestionsP1(qs.map(q => ({ ...q, options: shuffleArray([...q.options]) })));
      setQuestionsP2(shuffleArray(qs).map(q => ({ ...q, options: shuffleArray([...q.options]) })));
      
      setIndexP1(0); setIndexP2(0);
      setScoreP1(0); setScoreP2(0);
      setFinishedP1(false); setFinishedP2(false);
      
      setLoadingPhase("DEPLOYING TO ZONE...");
      setTimeout(() => {
        setScreen(GameScreen.GAMEPLAY);
        setLoading(false);
      }, 800);

    } catch (e: any) {
      console.error(e);
      setLoading(false);
      alert(e.message || "SIGNAL INTERRUPTED: Please check your connection or API configuration.");
    }
  };

  const handleAnswerP1 = (isCorrect: boolean) => {
    if (isCorrect) { setScoreP1(s => s + 5); audioService.playGunshot(); }
    else audioService.playType();
    if (indexP1 + 1 < questionsP1.length) setTimeout(() => setIndexP1(i => i + 1), 600);
    else setFinishedP1(true);
  };

  const handleAnswerP2 = (isCorrect: boolean) => {
    if (isCorrect) { setScoreP2(s => s + 5); audioService.playGunshot(); }
    else audioService.playType();
    if (indexP2 + 1 < questionsP2.length) setTimeout(() => setIndexP2(i => i + 1), 600);
    else setFinishedP2(true);
  };

  const finishQuiz = () => {
    audioService.playWin();
    if (user && selectedCategory) {
      const key = selectedCategory + (mathSub ? ` (${mathSub})` : '');
      const currentHigh = user.scores[key] || 0;
      if (scoreP1 > currentHigh) {
          const newScores = { ...user.scores, [key]: scoreP1 };
          saveUser({ ...user, scores: newScores });
      }
    }
    setScreen(GameScreen.RESULT);
  };

  const renderScreen = () => {
    switch (screen) {
      case GameScreen.TITLE: return <TitleScreen onStart={handleStart} />;
      case GameScreen.LOGIN: return <LoginScreen onLogin={handleLogin} />;
      case GameScreen.INSTRUCTIONS: return <InstructionsScreen onNext={() => setScreen(GameScreen.CHAR_SELECT)} />;
      case GameScreen.CHAR_SELECT: return <CharacterSelectScreen onSelect={handleCharacterSelect} />;
      case GameScreen.MAP: return <MapScreen user={user} onSelectCategory={(cat) => cat === Category.MATH ? setShowMathModal(true) : startQuiz(cat)} onLogout={() => { audioService.stopBGM(); setScreen(GameScreen.TITLE); }} />;
      case GameScreen.GAMEPLAY: return <SplitGameplayScreen questionsP1={questionsP1} questionsP2={questionsP2} indexP1={indexP1} indexP2={indexP2} scoreP1={scoreP1} scoreP2={scoreP2} finishedP1={finishedP1} finishedP2={finishedP2} onAnswerP1={handleAnswerP1} onAnswerP2={handleAnswerP2} />;
      case GameScreen.RESULT: return <ResultScreen scoreP1={scoreP1} scoreP2={scoreP2} onHome={() => setScreen(GameScreen.MAP)} />;
      default: return null;
    }
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none">
      <Cursor />
      {loading && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center font-ops text-yellow-500 tracking-widest text-center p-4">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 border-4 border-yellow-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            <Scan className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 animate-pulse" />
          </div>
          <h2 className="text-2xl mb-2 uppercase">Syncing Intel...</h2>
          <div className="flex flex-col items-center max-w-sm">
            <p className="text-sm text-white/70 uppercase font-mono tracking-tighter">{loadingPhase}</p>
            <div className="mt-6 w-64 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 animate-[loading-bar_2s_infinite]"></div>
            </div>
          </div>
          <style>{`@keyframes loading-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
        </div>
      )}
      {showMathModal && (
        <div className="absolute inset-0 z-40 bg-black/80 flex items-center justify-center backdrop-blur-sm">
           <div className="bg-slate-900 border-2 border-cyan-500 p-8 w-[90%] max-w-md clip-diagonal relative shadow-[0_0_50px_rgba(6,182,212,0.5)]">
              <h3 className="font-ops text-2xl text-cyan-400 mb-6 text-center uppercase">Tactical Ops: Math</h3>
              <div className="grid grid-cols-2 gap-4">
                {['Penjumlahan', 'Pengurangan', 'Perkalian', 'Pembagian'].map(op => (
                  <button key={op} onClick={() => { setShowMathModal(false); startQuiz(Category.MATH, op); }} className="bg-slate-800 hover:bg-cyan-600 border border-slate-600 hover:border-white p-4 text-white font-bold transition-all clip-diagonal hover:scale-105">{op.toUpperCase()}</button>
                ))}
              </div>
              <button onClick={() => setShowMathModal(false)} className="absolute top-2 right-2 text-red-500 hover:text-white font-bold">CANCEL</button>
           </div>
        </div>
      )}
      {renderScreen()}
    </div>
  );
}

const TitleScreen = ({ onStart }: { onStart: () => void }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover bg-center">
    <div className="absolute inset-0 bg-black/60"></div>
    <div className="z-10 text-center animate-pulse">
      <h1 className="font-ops text-6xl md:text-8xl text-yellow-500 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] mb-2">BATTLE</h1>
      <h1 className="font-ops text-5xl md:text-7xl text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">KNOWLEDGE</h1>
      <p className="mt-4 font-mono text-yellow-500 tracking-[0.5em] text-sm md:text-lg">SURVIVOR EDITION</p>
    </div>
    <button onClick={onStart} className="z-10 mt-16 px-12 py-4 bg-yellow-600 hover:bg-yellow-500 text-black font-ops text-2xl clip-diagonal transform hover:scale-110 transition-transform duration-200 shadow-[0_0_20px_rgba(234,179,8,0.5)]">TAP TO START</button>
  </div>
);

const LoginScreen = ({ onLogin }: { onLogin: (n: string, g: string) => void }) => {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const handleType = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => { audioService.playType(); setter(e.target.value); };
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="w-full max-md:max-w-[90%] max-w-md p-8 border-l-4 border-yellow-500 bg-slate-800/80 backdrop-blur-md shadow-2xl">
        <h2 className="font-ops text-3xl text-white mb-8 border-b border-white/20 pb-4">IDENTITAS SURVIVOR</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-yellow-500 font-bold mb-2 tracking-widest text-sm">CODENAME (NAMA)</label>
            <input type="text" value={name} onChange={(e) => handleType(e, setName)} className="w-full bg-black/50 border border-slate-600 text-white p-3 focus:border-yellow-500 focus:outline-none font-mono uppercase" placeholder="Enter Name..." />
          </div>
          <div>
            <label className="block text-yellow-500 font-bold mb-2 tracking-widest text-sm">RANK (KELAS)</label>
            <input type="text" value={grade} onChange={(e) => handleType(e, setGrade)} className="w-full bg-black/50 border border-slate-600 text-white p-3 focus:border-yellow-500 focus:outline-none font-mono" placeholder="Enter Class..." />
          </div>
          <button onClick={() => { if(name && grade) onLogin(name, grade); }} disabled={!name || !grade} className="w-full py-4 mt-4 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-600 text-black font-ops text-xl clip-diagonal transition-colors uppercase">Confirm Identity</button>
        </div>
      </div>
    </div>
  );
};

const InstructionsScreen = ({ onNext }: { onNext: () => void }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-8">
    <div className="max-w-3xl w-full border border-yellow-500/30 bg-slate-900/90 p-8 relative">
      <h2 className="font-ops text-3xl text-yellow-500 mb-6 text-center uppercase tracking-tighter">Battle Mode: Live Intel</h2>
      <ul className="space-y-4 text-slate-300 font-mono text-lg list-disc pl-6">
        <li>Intel is gathered in real-time using AI satellites.</li>
        <li>Compete across regions: Blue Team vs Red Team.</li>
        <li>Correct answers provide 5 XP points and tactical feedback.</li>
        <li>Mission goal: Clear all sectors for total Booyah! dominance.</li>
      </ul>
      <button onClick={() => { audioService.playClick(); onNext(); }} className="mt-8 float-right px-8 py-2 bg-yellow-600 text-black font-bold font-ops clip-diagonal hover:bg-white hover:text-black transition-all uppercase">Choose Agent</button>
    </div>
  </div>
);

const CharacterSelectScreen = ({ onSelect }: { onSelect: (id: string) => void }) => (
  <div className="w-full h-full bg-slate-900 flex flex-col p-4 md:p-8">
    <h2 className="font-ops text-3xl md:text-5xl text-white mb-8 text-center uppercase">Select Survivor</h2>
    <div className="flex-1 overflow-x-auto flex items-center gap-8 px-4 pb-4">
      {CHARACTERS.map(char => (
        <div key={char.id} onClick={() => onSelect(char.id)} className="min-w-[280px] h-[450px] bg-slate-800 border-2 border-slate-600 hover:border-yellow-500 relative cursor-none group transition-all transform hover:-translate-y-4">
          <img src={char.image} alt={char.name} className="w-full h-3/5 object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
          <div className="p-4 bg-gradient-to-t from-black to-slate-800 h-2/5 flex flex-col">
            <h3 className="font-ops text-2xl text-yellow-500">{char.name}</h3>
            <span className="text-xs bg-yellow-600 text-black px-2 py-1 w-max font-bold mb-2 uppercase">{char.role}</span>
            <p className="text-slate-400 text-sm">{char.description}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const MapScreen = ({ user, onSelectCategory, onLogout }: { user: User | null, onSelectCategory: (c: Category) => void, onLogout: () => void }) => {
  const getCategoryColor = (cat: Category) => {
      switch (cat) {
          case Category.MATH: return 'border-cyan-500 from-cyan-900/80 to-slate-900 text-cyan-400';
          case Category.HISTORY_INDO: case Category.PRESIDENTS: case Category.PROPHET: return 'border-red-500 from-red-900/80 to-slate-900 text-red-400';
          default: return 'border-emerald-500 from-emerald-900/80 to-slate-900 text-emerald-400';
      }
  };
  const getIcon = (cat: Category) => {
      switch (cat) {
          case Category.MATH: return <Zap />;
          case Category.HISTORY_INDO: return <Flag />;
          case Category.SCIENCE: return <FlaskConical />;
          case Category.CAPITALS: return <Globe />;
          case Category.DANCES: return <Music />;
          default: return <Book />;
      }
  }
  return (
    <div className="w-full h-full bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover relative overflow-hidden">
      <div className="absolute inset-0 bg-black/80"></div>
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black via-black/90 to-transparent pb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-yellow-600 flex items-center justify-center clip-diagonal shadow-[0_0_15px_rgba(234,179,8,0.5)]">
            <UserIcon className="text-black w-8 h-8" />
          </div>
          <div>
            <h2 className="font-ops text-2xl text-yellow-500 uppercase">{user?.name || "RECRUIT"}</h2>
            <div className="flex items-center gap-2">
                <span className="bg-yellow-600/20 text-yellow-500 px-2 py-0.5 text-xs font-mono border border-yellow-600/50 rounded uppercase">Level {user?.grade || "0"}</span>
            </div>
          </div>
        </div>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-500 p-3 clip-diagonal transition-all hover:scale-105"><LogOut size={20} className="text-white" /></button>
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-8 pt-28 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-7xl pb-10">
          {Object.values(Category).map((cat, idx) => {
            const score = user?.scores[cat] || 0; 
            const style = getCategoryColor(cat);
            return (
              <button key={idx} onClick={() => onSelectCategory(cat)} className={`relative h-40 bg-gradient-to-br border-2 transition-all duration-300 group clip-diagonal text-left p-0 overflow-hidden hover:scale-105 hover:z-10 shadow-lg ${style}`}>
                <div className="absolute right-0 top-0 w-24 h-full bg-black/20 transform skew-x-12 translate-x-12"></div>
                <div className="p-5 h-full flex flex-col justify-between relative z-10">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-black/30 rounded border border-white/10 backdrop-blur-sm">{getIcon(cat)}</div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity"><Crosshair size={24} className="animate-pulse" /></div>
                    </div>
                    <div>
                        <span className="text-xs font-mono opacity-70 mb-1 uppercase">Region {idx + 1}</span>
                        <h3 className="font-bold font-mono text-lg leading-tight text-white uppercase">{cat}</h3>
                    </div>
                    {score > 0 && (
                        <div className="absolute bottom-0 left-0 w-full bg-black/50 py-1 px-4 flex justify-between items-center border-t border-white/10">
                            <span className="text-xs text-yellow-500 font-bold uppercase">Secured</span>
                            <span className="text-yellow-400 font-mono font-bold uppercase">{score} XP</span>
                        </div>
                    )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
};

const PlayerZone = ({ label, colorClass, questions, index, score, finished, onAnswer, isMirrored }: any) => {
  const [clickedOption, setClickedOption] = useState<string | null>(null);
  const currentQ = questions[index];
  
  useEffect(() => { setClickedOption(null); }, [index]);

  const handleOptionClick = (opt: string) => {
    if (clickedOption || finished) return; 
    setClickedOption(opt);
    const isCorrect = opt === currentQ.correctAnswer;
    onAnswer(isCorrect);
  };

  if (finished) {
    return (
      <div className={`w-1/2 h-full flex flex-col items-center justify-center bg-black/80 border-${isMirrored ? 'l' : 'r'} border-white/10 p-4 text-center`}>
        <h2 className={`font-ops text-5xl mb-4 ${colorClass} uppercase`}>CLEARED</h2>
        <div className="text-8xl font-mono text-white mb-2">{score}</div>
        <div className="text-lg text-slate-500 tracking-widest uppercase">Score Secured</div>
      </div>
    );
  }

  if (!currentQ) return <div className="w-1/2 h-full bg-black flex items-center justify-center text-yellow-500 font-ops animate-pulse uppercase">Syncing Intel...</div>;

  return (
    <div className={`w-1/2 h-full flex flex-col relative bg-slate-900/50 ${isMirrored ? 'border-l-4' : 'border-r-4'} border-black overflow-hidden`}>
       <div className={`h-16 bg-gradient-to-b from-black/95 to-transparent flex items-center justify-between px-6 border-b z-20 relative ${isMirrored ? 'border-red-600' : 'border-blue-600'}`}>
         <div className="flex items-center gap-4">
            <div className={`px-3 py-1 text-xs font-bold text-black uppercase ${isMirrored ? 'bg-red-500' : 'bg-blue-500'}`}>{label}</div>
            <span className="font-mono text-white text-lg">{index + 1}/{questions.length}</span>
         </div>
         <div className="font-ops text-3xl text-white">{score}</div>
       </div>
       <div className="relative flex-none h-1/2 m-4 bg-black/80 border-2 border-slate-700/50 clip-diagonal z-20 flex flex-col items-center justify-center text-center shadow-xl overflow-hidden">
          {currentQ.imageUrl && (
            <div className="absolute inset-0 w-full h-full">
                <img src={currentQ.imageUrl} className="w-full h-full object-cover opacity-60" alt="Intel" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40"></div>
            </div>
          )}
          <div className="relative z-10 px-4"><p className="text-white font-bold text-xl md:text-2xl leading-tight drop-shadow-lg">{currentQ.question}</p></div>
       </div>
       <div className="flex-1 px-4 pb-4 overflow-y-auto">
           <div className="flex flex-col gap-2">
             {currentQ.options.map((opt: string, i: number) => {
               const labels = ['A', 'B', 'C', 'D'];
               let optionStyle = "bg-slate-800/60 border-slate-600 text-white hover:bg-slate-700/80 hover:border-yellow-500";
               let prefixStyle = "bg-slate-700 text-slate-400";
               
               if (clickedOption === opt) {
                   if (opt === currentQ.correctAnswer) {
                       optionStyle = "bg-green-600 border-green-400 text-white animate-click shadow-[0_0_20px_rgba(74,222,128,0.5)]";
                       prefixStyle = "bg-green-400 text-black";
                   } else {
                       optionStyle = "bg-red-600 border-red-400 text-white shadow-[0_0_20px_rgba(248,113,113,0.5)]";
                       prefixStyle = "bg-red-400 text-black";
                   }
               } else if (clickedOption && opt === currentQ.correctAnswer) {
                   optionStyle = "bg-green-900/40 border-green-500 text-green-300";
                   prefixStyle = "bg-green-600 text-white";
               }

               return (
                  <button key={`${index}-${i}`} className={`group flex items-center w-full min-h-[56px] border-2 transition-all text-left clip-diagonal overflow-hidden relative ${optionStyle}`} onClick={() => handleOptionClick(opt)}>
                    <div className={`w-12 h-full flex items-center justify-center font-ops text-lg border-r-2 border-inherit flex-none ${prefixStyle}`}>{labels[i]}</div>
                    <div className="px-4 py-3 flex-1 font-bold text-base md:text-lg leading-tight uppercase">{opt}</div>
                  </button>
               )
             })}
           </div>
       </div>
    </div>
  );
};

const SplitGameplayScreen = (props: any) => (
  <div className="w-full h-full flex relative bg-black">
     <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-500 via-transparent to-yellow-500 z-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black border-2 border-yellow-500 p-3 rounded-full z-40"><Swords size={28} className="text-yellow-500 animate-pulse" /></div>
     </div>
     <PlayerZone label="Blue Team" questions={props.questionsP1} index={props.indexP1} score={props.scoreP1} finished={props.finishedP1} onAnswer={props.onAnswerP1} isMirrored={false} colorClass="text-blue-500" />
     <PlayerZone label="Red Team" questions={props.questionsP2} index={props.indexP2} score={props.scoreP2} finished={props.finishedP2} onAnswer={props.onAnswerP2} isMirrored={true} colorClass="text-red-500" />
  </div>
);

const ResultScreen = ({ scoreP1, scoreP2, onHome }: any) => {
    const winner = scoreP1 > scoreP2 ? 'Blue Team' : scoreP1 < scoreP2 ? 'Red Team' : 'Draw';
    const color = scoreP1 > scoreP2 ? 'text-blue-500' : scoreP1 < scoreP2 ? 'text-red-500' : 'text-yellow-500';
    return (
        <div className="w-full h-full bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 p-10 flex flex-col items-center relative clip-diagonal shadow-2xl">
                <h2 className="font-ops text-5xl text-white mb-2 tracking-widest uppercase">Booyah!</h2>
                <div className="flex w-full justify-between items-center my-10 px-10">
                   <div className="text-center"><div className="text-blue-500 font-ops text-2xl mb-2 uppercase">Blue</div><div className="text-7xl font-mono text-white">{scoreP1}</div></div>
                   <div className="text-center"><div className={`font-ops text-5xl uppercase ${color} animate-pulse`}>{winner}</div></div>
                   <div className="text-center"><div className="text-red-500 font-ops text-2xl mb-2 uppercase">Red</div><div className="text-7xl font-mono text-white">{scoreP2}</div></div>
                </div>
                <button onClick={onHome} className="w-full py-5 bg-yellow-600 hover:bg-yellow-500 text-black font-bold font-ops text-2xl clip-diagonal mt-6 transition-all uppercase">Return to Lobby</button>
            </div>
        </div>
    );
}

export default App;