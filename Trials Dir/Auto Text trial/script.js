const containerEl = document.querySelector('.container');

const careers = ['Web Developer', 'Flutter Developer', 'SQL admi....', 'Auto Mech'];

let careerIndex = 0;
let characterIndex = 0;

// const vowelList = ['a', 'o', 'i', 'e', 'u', 'A'];
// let vowelCharIndex = 0;

updateText();

function updateText(){
    characterIndex++;
    containerEl.innerHTML = `<h1>I am ${careers[careerIndex].slice(0,1) === 'A' ? "an" : "a"} ${careers[careerIndex].slice(0, characterIndex)}</h1>`;
    

    if(characterIndex === careers[careerIndex].length){
        careerIndex++;
        characterIndex =0;
    }

    if(careerIndex === careers.length){
        careerIndex = 0;
    }

    setTimeout(updateText, 400);
}

