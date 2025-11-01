
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

const App = () => {
    const [personImage, setPersonImage] = useState(null);
    const [itemImage, setItemImage] = useState(null);
    const [editedImage, setEditedImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // FIX: Correctly handle FileReader.result typing and ensure the promise resolves to a string.
    // This resolves two issues:
    // 1. `reader.result` is typed as `string | ArrayBuffer | null`, so we need a type check before calling `.split()`.
    // 2. The promise from `new Promise` was untyped, causing `base64EncodedData` to be of type `unknown`, which led to a type error in `ai.models.generateContent`.
    //    By typing `new Promise<string>`, we ensure `base64EncodedData` is correctly typed as `string`.
    const fileToGenerativePart = async (file) => {
        const base64EncodedData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result.split(',')[1]);
                } else {
                    resolve('');
                }
            };
            reader.readAsDataURL(file);
        });
        return {
            inlineData: { data: base64EncodedData, mimeType: file.type },
        };
    };

    const handleImageUpload = useCallback((e, setImage) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage({
                    file: file,
                    url: reader.result,
                });
                setEditedImage(null);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleGenerate = async () => {
        if (!personImage || !itemImage) return;

        setIsLoading(true);
        setError(null);
        setEditedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const personImagePart = await fileToGenerativePart(personImage.file);
            const itemImagePart = await fileToGenerativePart(itemImage.file);
            const prompt = "Generate a new image showing the person from the first image realistically wearing the clothing item from the second image. The final image should only contain the person with the new clothing, on a clean or simple background. Do not include the original clothing or multiple versions of the person.";

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        personImagePart,
                        itemImagePart,
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
            
            const firstCandidate = response.candidates?.[0];
            const imagePartFromResponse = firstCandidate?.content?.parts?.find(part => part.inlineData);

            if (imagePartFromResponse) {
                const base64ImageBytes = imagePartFromResponse.inlineData.data;
                const mimeType = imagePartFromResponse.inlineData.mimeType;
                const imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;
                setEditedImage(imageUrl);
            } else {
                 throw new Error("No image was generated. Please try different images.");
            }

        } catch (err) {
            console.error(err);
            setError(err.message || "An unexpected error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container">
            <header>
                <h1>Gemini <span className="highlight">Virtual Try-On</span></h1>
                <p>See how clothes and accessories look on you. Upload your photo and a photo of an item.</p>
            </header>

            <main className="main-content">
                <div className="panel controls-panel">
                    <div className="form-group">
                        <label htmlFor="person-image-upload">1. Upload Your Photo</label>
                         <label htmlFor="person-image-upload" className="image-uploader">
                            {personImage ? (
                                <div className="image-preview-container">
                                    <img src={personImage.url} alt="Person preview" className="image-preview" />
                                </div>
                            ) : (
                                <p>Click or drag to upload</p>
                            )}
                        </label>
                        <input
                            id="person-image-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, setPersonImage)}
                            style={{ display: 'none' }}
                            aria-label="Upload your photo"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="item-image-upload">2. Upload Clothing Item</label>
                         <label htmlFor="item-image-upload" className="image-uploader">
                            {itemImage ? (
                                <div className="image-preview-container">
                                    <img src={itemImage.url} alt="Clothing item preview" className="image-preview" />
                                </div>
                            ) : (
                                <p>Click or drag to upload</p>
                            )}
                        </label>
                        <input
                            id="item-image-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, setItemImage)}
                            style={{ display: 'none' }}
                            aria-label="Upload a clothing item"
                        />
                    </div>
                    <button
                        className="btn"
                        onClick={handleGenerate}
                        disabled={!personImage || !itemImage || isLoading}
                        aria-busy={isLoading}
                    >
                         {isLoading && <div className="spinner" style={{width: '20px', height: '20px', borderWidth: '2px', margin: '0'}}></div>}
                        {isLoading ? 'Generating...' : 'Generate Image'}
                    </button>
                    {error && <div className="error-message">{error}</div>}
                </div>
                <div className="panel results-panel" aria-live="polite">
                     {isLoading && (
                        <div className="loading-overlay">
                            <div className="spinner"></div>
                            <p>Putting it all together...</p>
                        </div>
                    )}
                    {editedImage ? (
                        <img src={editedImage} alt="Edited result" className="result-image" />
                    ) : (
                       !isLoading && <p className="placeholder-text">Your try-on image will appear here.</p>
                    )}
                </div>
            </main>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
