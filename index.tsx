import React, { useState, FormEvent, FC, useRef, ChangeEvent, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// --- TYPES --- //
interface StoryBlock {
  id: string; // Unique ID like `chapterIdx-blockIdx`
  type: 'paragraph' | 'image';
  content: string; // For paragraph: text. For image: initially prompt, then image URL.
  status?: 'loading' | 'loaded';
}

interface Chapter {
    title: string;
    blocks: StoryBlock[];
}

interface RawStoryBlock {
    type: 'paragraph' | 'image_prompt';
    content: string;
}

interface RawChapter {
    chapter_title: string;
    content_blocks: RawStoryBlock[];
}

// --- API INITIALIZATION --- //
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- HELPER FUNCTIONS --- //
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// --- REACT COMPONENTS & ICONS --- //
const AttachmentIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M14.063 5.28a1 1 0 00-1.414 0l-6.75 6.75a2.5 2.5 0 003.535 3.536l5.37-5.37a1 1 0 10-1.414-1.414l-5.37 5.37a.5.5 0 01-.707-.707l5.37-5.37a1 1 0 00-1.415-1.414l-6.078 6.078a4 4 0 105.657 5.657l6.75-6.75a3 3 0 00-4.242-4.243z" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm3.414 7.586a1 1 0 00-1.414-1.414L12 10.586l-1.99-1.99a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l2-2z" />
    </svg>
);

const SoundOnIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M11.999 4.318a1 1 0 00-1.317-1.11L3.99 7H2a1 1 0 00-1 1v8a1 1 0 001 1h1.99l6.692 3.793a1 1 0 001.317-1.11V4.318zM15.5 8.5a1 1 0 10-1 1.732A3.5 3.5 0 0116 12a3.5 3.5 0 01-1.5 2.768 1 1 0 101 1.732A5.5 5.5 0 0018 12a5.5 5.5 0 00-2.5-4.5zM18.5 5.5a1 1 0 10-1 1.732A6.5 6.5 0 0120 12a6.5 6.5 0 01-2.5 4.768 1 1 0 101 1.732A8.5 8.5 0 0022 12a8.5 8.5 0 00-3.5-6.5z"/>
    </svg>
);

const SoundOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M11.999 4.318a1 1 0 00-1.317-1.11L3.99 7H2a1 1 0 00-1 1v8a1 1 0 001 1h1.99l6.692 3.793a1 1 0 001.317-1.11V4.318zm4.437 2.914a1 1 0 00-1.414 1.414l4.95 4.95a1 1 0 001.414-1.414l-4.95-4.95zm-1.414 4.95l-4.95 4.95a1 1 0 001.414 1.414l4.95-4.95a1 1 0 00-1.414-1.414z"/>
    </svg>
);


const EmptyState = () => (
  <div className="status-message" role="status">
    <h2>The Void Awaits</h2>
    <p>The cosmos is listening. Provide a seed, an idea, an image. A story will bloom.</p>
  </div>
);

const ErrorState = ({ message }: { message: string }) => (
  <div className="status-message error" role="alert">
    <h2>A Tear in the Fabric</h2>
    <p>The connection was lost. The narrative stream is unstable. Please try again. ({message})</p>
  </div>
);

const SkeletonLoader = () => (
  <div className="skeleton-container">
    <div className="skeleton-chapter">
      <div className="skeleton-title"></div>
      <div className="skeleton-text long"></div>
      <div className="skeleton-image"></div>
      <div className="skeleton-text medium"></div>
    </div>
    <div className="skeleton-chapter">
      <div className="skeleton-title"></div>
      <div className="skeleton-text long"></div>
      <div className="skeleton-text medium"></div>
    </div>
  </div>
);

const StoryImage: FC<{ block: StoryBlock }> = ({ block }) => {
    if (block.status === 'loading') {
        return <div className="image-loader" aria-label="Weaving image from light..."></div>;
    }
    return (
        <div className="story-image-wrapper">
            <img src={block.content} alt="A generated image illustrating the story chapter" className="story-image" />
        </div>
    );
};

const MutationControls: FC<{ onMutate: (directive: string) => void; isLoading: boolean; }> = ({ onMutate, isLoading }) => (
    <div className="mutation-container">
        <h3>Mutate the Narrative</h3>
        <div className="mutation-buttons">
            <button className="mutate-button" onClick={() => onMutate("Change the genre to cosmic horror, with a sense of dread and unsettling entities.")} disabled={isLoading}>Cosmic Horror</button>
            <button className="mutate-button" onClick={() => onMutate("Rewrite it with a hopeful, utopian ending where the conflict is resolved peacefully.")} disabled={isLoading}>Utopian Ending</button>
            <button className="mutate-button" onClick={() => onMutate("Shift the tone to be more melancholic and somber, focusing on loss and memory.")} disabled={isLoading}>Melancholic Tone</button>
            <button className="mutate-button" onClick={() => onMutate("Introduce a surprising betrayal from a character who seemed to be an ally.")} disabled={isLoading}>Add Betrayal</button>
        </div>
    </div>
);


const App = () => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storyContent, setStoryContent] = useState<Chapter[]>([]);
  const [storyTextForMutation, setStoryTextForMutation] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = 0.2;
    }
  }, []);

  const toggleMute = () => {
    if (!audioRef.current) return;

    const shouldBeMuted = !isMuted;
    setIsMuted(shouldBeMuted);

    if (shouldBeMuted) {
        audioRef.current.pause();
    } else {
        audioRef.current.play().catch(e => {
            console.error("Audio playback failed. This can happen if the browser blocks autoplay before user interaction.", e);
            // Revert state if play fails, so UI is consistent
            setIsMuted(true);
        });
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      const b64 = await fileToBase64(file);
      setImageBase64(b64);
    }
  };
  
  const handleRemoveImage = () => {
      setImage(null);
      setImageBase64(null);
      if(fileInputRef.current) {
          fileInputRef.current.value = "";
      }
  }

  const processAndDisplayStory = (rawChapters: RawChapter[]) => {
      const initialContent: Chapter[] = rawChapters.map((chapter, chapIdx) => ({
          title: chapter.chapter_title,
          blocks: chapter.content_blocks.map((block, blockIdx) => ({
              id: `${chapIdx}-${blockIdx}`,
              type: block.type === 'paragraph' ? 'paragraph' : 'image',
              content: block.content,
              status: block.type === 'image_prompt' ? 'loading' : 'loaded'
          }))
      }));
      setStoryContent(initialContent);
      setIsLoading(false);

      const storyAsText = rawChapters.map(c => `Chapter: ${c.chapter_title}\n` + c.content_blocks.map(b => b.content).join('\n')).join('\n\n');
      setStoryTextForMutation(storyAsText);

      // Generate images progressively
      initialContent.forEach((chapter, chapIdx) => {
          chapter.blocks.forEach(async (block, blockIdx) => {
              if (block.type === 'image' && block.status === 'loading') {
                  try {
                    const imageResponse = await ai.models.generateImages({
                        model: 'imagen-3.0-generate-002',
                        prompt: `${block.content}, cinematic, high detail, epic lighting, futuristic, tech noir, cosmic`,
                        config: {
                          numberOfImages: 1,
                          outputMimeType: 'image/jpeg',
                          aspectRatio: '16:9',
                        },
                    });
                    const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
                    const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

                    setStoryContent(prev => prev.map((c, cIdx) => 
                        cIdx !== chapIdx ? c : {
                            ...c,
                            blocks: c.blocks.map((b, bIdx) => 
                                b.id !== block.id ? b : { ...b, content: imageUrl, status: 'loaded' }
                            )
                        }
                    ));
                  } catch (imgErr) {
                      console.error(`Failed to generate image for block ${block.id}:`, imgErr);
                      setStoryContent(prev => prev.map((c, cIdx) => 
                        cIdx !== chapIdx ? c : {
                            ...c,
                            blocks: c.blocks.map((b, bIdx) => 
                                b.id !== block.id ? b : { ...b, content: 'Error: Image could not be generated.', status: 'loaded' }
                            )
                        }
                    ));
                  }
              }
          });
      });
  }

  const generateOrMutateStory = async (fullPrompt: string, imageParts: any[]) => {
    try {
        const storyGenParts: any[] = [{ text: fullPrompt }, ...imageParts];
  
        const storyResponse: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: storyGenParts },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                  story: {
                      type: Type.ARRAY,
                      description: "An array of story chapters.",
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              chapter_title: {
                                  type: Type.STRING,
                                  description: "The title of the chapter."
                              },
                              content_blocks: {
                                  type: Type.ARRAY,
                                  description: "An array of paragraphs and image prompts for the chapter. Each paragraph must be followed by an image_prompt.",
                                  items: {
                                      type: Type.OBJECT,
                                      properties: {
                                          type: {
                                              type: Type.STRING,
                                              enum: ["paragraph", "image_prompt"]
                                          },
                                          content: {
                                              type: Type.STRING,
                                              description: "The text of the paragraph or the detailed image generation prompt."
                                          }
                                      },
                                      required: ["type", "content"]
                                  }
                              }
                          },
                          required: ["chapter_title", "content_blocks"]
                      }
                  }
              },
              required: ["story"]
            },
          },
        });
  
        const rawChapters: RawChapter[] = JSON.parse(storyResponse.text).story;
        if (!rawChapters || rawChapters.length === 0) {
          throw new Error("The AI could not weave a story from this concept. Please try a different seed.");
        }
  
        processAndDisplayStory(rawChapters);
  
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An unknown error occurred during transmission.');
        setIsLoading(false);
      }
  }

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading || (!prompt && !image)) return;

    setIsLoading(true);
    setError(null);
    setStoryContent([]);
    setStoryTextForMutation(null);
    
    const storyGenPrompt = `You are an expert speculative fiction author creating an illustrated graphic novel. Take the user's concept and expand it into a rich, multi-chapter short story. For each chapter, provide a compelling title. Within each chapter, you must follow a strict format: write one paragraph of narrative, and immediately follow it with an 'image_prompt' for an AI to visualize that paragraph. This creates a tight, cinematic loop of text and image. The image prompt should be detailed, descriptive, and aligned with a 'cosmic, tech-noir' aesthetic. Your entire output MUST be a JSON object containing a single key "story" which is an array of chapter objects. Each chapter object must have: 1. A "chapter_title" string. 2. A "content_blocks" array. Each item in "content_blocks" must be an object with: 1. A "type" which is either "paragraph" or "image_prompt". 2. A "content" string. Adhere to the paragraph-then-image structure strictly.`;
    const userContext = `User's concept: "${prompt}"`;
    const fullPrompt = `${storyGenPrompt}\n\n${userContext}`;
    
    let imageParts: any[] = [];
    if (imageBase64 && image) {
        imageParts.push({
            inlineData: { mimeType: image.type, data: imageBase64.split(',')[1] },
        });
    }

    await generateOrMutateStory(fullPrompt, imageParts);
  };

  const handleMutate = async (directive: string) => {
    if (isLoading || !storyTextForMutation) return;

    setIsLoading(true);
    setError(null);
    setStoryContent([]);
    setStoryTextForMutation(null);

    const mutationPrompt = `You are an AI editor. Your task is to rewrite a story based on a specific directive. You must adhere to the directive, but keep the core essence and characters of the original story if possible. Your output must be a complete new story in the same multi-chapter JSON format.
    
    Directive: "${directive}"
    
    Original Story:
    ---
    ${storyTextForMutation}
    ---
    
    Now, rewrite the entire story based on the directive, following the original JSON structure precisely (a "story" key with an array of chapters, each with "chapter_title" and "content_blocks" containing "type" and "content" in a paragraph-then-image pattern).`;
    
    await generateOrMutateStory(mutationPrompt, []);
  }

  return (
    <>
      <header className="main-header">
        <div className="container">
          <h1>PROJECT ASTRAL</h1>
          <p>Weaving narratives from the ether.</p>
        </div>
      </header>

      <main>
        <div className="prompt-container">
          <div className="container">
            <form className="prompt-form" onSubmit={handleGenerate}>
              <div className="input-wrapper">
                 <input
                    type="text"
                    className="prompt-input"
                    placeholder="Seed the narrative: a forgotten star, a sentient city..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    aria-label="Story prompt"
                    disabled={isLoading}
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                    aria-hidden="true"
                    disabled={isLoading}
                   />
                   <button 
                     type="button" 
                     className="attachment-button"
                     onClick={() => fileInputRef.current?.click()}
                     aria-label="Attach image as a story seed"
                     disabled={isLoading}
                    >
                     <AttachmentIcon />
                   </button>
              </div>
              <button type="submit" className="generate-button" disabled={isLoading || (!prompt && !image)}>
                {isLoading ? 'Weaving...' : 'Manifest'}
              </button>
            </form>
            {imageBase64 && (
                <div className="image-preview-container">
                    <div className="image-preview">
                        <img src={imageBase64} alt="Image seed preview" />
                        <button onClick={handleRemoveImage} className="remove-image-button" aria-label="Remove image seed">
                            <CloseIcon />
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>

        <div className="results-area container">
          {isLoading && <SkeletonLoader />}
          {error && <ErrorState message={error} />}
          {!isLoading && !error && storyContent.length > 0 && (
            <>
              <div className="story-output-container">
                {storyContent.map((chapter, chapIdx) => (
                  <div key={chapIdx} className="chapter-container">
                      <h2 className="chapter-title">{chapter.title}</h2>
                      {chapter.blocks.map((block) => {
                          if (block.type === 'paragraph') {
                              return <p key={block.id} className="story-paragraph">{block.content}</p>
                          }
                          if (block.type === 'image') {
                              return <StoryImage key={block.id} block={block} />
                          }
                          return null;
                      })}
                  </div>
                ))}
              </div>
              <MutationControls onMutate={handleMutate} isLoading={isLoading} />
            </>
          )}
          {!isLoading && !error && storyContent.length === 0 && <EmptyState />}
        </div>
      </main>

      <footer className="main-footer">
        <p>Powered by the ASTRAL Engine &amp; <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer">Google Gemini</a></p>
      </footer>

      <audio
        ref={audioRef}
        src="https://cdn.pixabay.com/audio/2022/10/18/audio_73155152a9.mp3"
        loop
        preload="auto"
        aria-hidden="true"
      />
      <button onClick={toggleMute} className="audio-toggle" aria-label={isMuted ? "Unmute audio" : "Mute audio"}>
        {isMuted ? <SoundOffIcon /> : <SoundOnIcon />}
      </button>
    </>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);