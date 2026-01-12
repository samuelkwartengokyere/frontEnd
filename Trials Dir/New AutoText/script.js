const containerEl = document.querySelector('.container');



const career = ['frontEnd engineer','software engineer', 'machine learning engineer', 'flutter developer', 'ai engineer'];

let careerIndex = 0;

let charIndex = 0;

updateText();

function updateText(){
    charIndex++;
    containerEl.innerHTML =   `<h1>I am ${career[careerIndex].slice(0, 1)=== 'a' ? 'an' : 'a'} ${career[careerIndex].slice(0, charIndex)}</h1>`;
    


    if(charIndex === career[careerIndex].length){
        careerIndex++;

        charIndex = 0;
    }

    if(careerIndex === career.length){
        careerIndex = 0;
    }


    setTimeout(updateText,  400)
    
}