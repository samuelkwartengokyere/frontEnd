// const users = {
//     name: ['Samuel Okyere', 'Seth Danso']
// }

const testimonial = [
    {
        name: 'Samuel Okyere',

        photoUrl: '3D Games Wallpaper 2014.jpg',

        text: 'This is simply  unbelievable! I would be lost without RedMagic. The very best. Not able to tell you how happy I am with RedMagic.'
    },

    {
        name: 'Seth Danso',

        photoUrl: 'love_11685515.png',

        text: 'Thank you for making it painless, pleasant and most of all hassle free! I wish I would have thought of it first.'
    }
]


const imgEl = document.querySelector('img')
const paraEl = document.querySelector('.text')
const usernameEl = document.querySelector('.username')



let index = 0;

updateTestimonial()

function updateTestimonial(){
    const {name, photoUrl, text} = testimonial[index];

    imgEl.src = photoUrl;
    paraEl.innerHTML = text;
    usernameEl.innerHTML = name;

    index++;

    if(index === testimonial.lenght){
        index = 0;
    }


    setTimeout( updateTestimonial, 10000);

}