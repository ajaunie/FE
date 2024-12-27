import React, { useEffect, useRef, useState } from 'react';
import { SWATCHES } from '@/constants';
import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import axios from 'axios'; 
import Draggable from 'react-draggable';

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

interface GeneratedResult {
    expression: string;
    answer: string;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEraser, setIsEraser] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [results, setResults] = useState<Array<GeneratedResult>>([]);
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);

    const [dictOfVars ,setDictOfVars] = useState({});

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (results.length > 0) {
            results.forEach(({ expression, answer }) => {
                const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
                setLatexExpression(prevLatex => [...prevLatex, latex]);
            });
        }
    }, [results]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResults([]);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        const canvas = canvasRef.current;
    
        if (canvas) {
            console.log('Sending data...', '${import.meta.env.VITE_API_URL}/calculate');
            console.log(import.meta.env.VITE_API_URL);
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                ctx.lineCap = 'round';
                ctx.lineWidth = 3;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
            script.async = true;
            document.head.appendChild(script);

            script.onload = () => {
                window.MathJax.Hub.Config({
                    tex2jax: {inlineMath: [['$', '$'], ['\\(', '\\)']]},
                });
            };

            return () => {
                document.head.removeChild(script);
            };
        }
    }, []);

    //send data to BE
    const sendData = async () => {
        try {
            const canvas = canvasRef.current;    
            if (canvas) {
                console.log('Sending data...', `${import.meta.env.VITE_API_URL}/calculate`);
                const response = await axios({
                    method: 'post',
                    url: `${import.meta.env.VITE_API_URL}/calculate`,
                    data: {
                        image: canvas.toDataURL('image/png'),
                        dict_of_vars: dictOfVars,
                    }
                });
                const resp = await response.data;
                console.log('Response: ', resp );

                // Collect all results and update state
                resp.data.forEach((data: Response) => {
                    if (data.assign === true) {
                        setDictOfVars({
                            ...dictOfVars,
                            [data.expr]: data.result
                        });
                    }
                });

                const ctx = canvas.getContext('2d');
                const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
                let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const i = (y * canvas.width + x) * 4;
                        if (imageData.data[i + 3] > 0) {  // If pixel is not transparent
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }

                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;

                setLatexPosition({ x: centerX, y: centerY });

                // Append all results
                resp.data.forEach((data: Response) => {
                    setTimeout(() => {
                        setResults(prevResults => [
                            ...prevResults,
                            {
                                expression: data.expr,
                                answer: data.result
                            }
                        ]);
                    }, 1000);
                });
            }
        } catch (error) {
            console.error('Error sending data:', error);
        }
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        // Check if the event is a touch event
        const isTouch = 'touches' in e;
        const offsetX = isTouch ? e.touches[0].clientX - canvasRef.current!.getBoundingClientRect().left : e.nativeEvent.offsetX;
        const offsetY = isTouch ? e.touches[0].clientY - canvasRef.current!.getBoundingClientRect().top : e.nativeEvent.offsetY;

        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.background = 'black';
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(offsetX, offsetY);
                setIsDrawing(true);
            }
        }
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) {
            return;
        }
        const isTouch = 'touches' in e;
        const offsetX = isTouch ? e.touches[0].clientX - canvasRef.current!.getBoundingClientRect().left : e.nativeEvent.offsetX;
        const offsetY = isTouch ? e.touches[0].clientY - canvasRef.current!.getBoundingClientRect().top : e.nativeEvent.offsetY;

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = isEraser ? 'black' : color;
                ctx.lineWidth = isEraser ? 20 : 3;
                ctx.lineTo(offsetX, offsetY);
                ctx.stroke();
            }
        }
    };
    
    const stopDrawing = () => {
        setIsDrawing(false);
    }

  return (
    <>
        <div className='grid grid-cols-2 gap-2'>
            <div className='flex-col flex'>
            <Button
                onClick={() => setReset(true)}
                className='font-bold text-lg z-20 bg-black text-white border border-zinc-50 border-opacity-50 hover:border-white' // Added hover border
                variant='default' 
                color='black'
            >
                🔄 Reset  
            </Button>
            <Button
                onClick={sendData}
                className='font-bold text-lg z-20 bg-black text-white border border-zinc-50 border-opacity-50 hover:border-white' // Added hover border
                variant='default'
                color='white'
            >
                🧮 Calculate
            </Button>
            <Button
                onClick={() => setIsEraser(prev => !prev)}
                className='font-bold text-lg z-20 bg-black text-white border border-zinc-50 border-opacity-50 hover:border-white' // Added hover border
                variant='default'
                color='white'
            > {isEraser ? '✏️ Draw' : '🧽 Eraser'}
            </Button>
            </div>
            <Group className='z-20 flex flex-wrap justify-start'> 
                {SWATCHES.map((swatch) => (
                    <div 
                        className={`m-0.5 transform transition-transform duration-200 hover:scale-110 ${color === swatch ? 'border-2 border-white rounded-full' : ''}`} // Added circular border for selected color
                    >
                        <ColorSwatch key={swatch} color={swatch} onClick={() => setColor(swatch)} />
                    </div>
                ))}
            </Group>
            
        </div>
        <canvas 
            ref={canvasRef}
            id='canvas'
            className='absolute top-0 left-0 w-full h-full' 
            style={{ touchAction: 'none' }} // Prevent default touch actions
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseOut={stopDrawing}
            onMouseUp={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
        />
        {latexExpression && latexExpression.map((latex, index) => (
            <Draggable
                key={index}
                defaultPosition={latexPosition}
                onStop={(_, data) => setLatexPosition({ x: data.x, y: data.y })}
            >
                <div className="absolute p-2 text-white rounded shadow-md">
                    <div className="latex-content">{latex}</div>
                </div>
            </Draggable>
        ))}
    </>
  )
}
