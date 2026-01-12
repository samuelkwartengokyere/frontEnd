const testimonialCard = [
    {
        name: 'Samuel Okyere',
        text: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Maxime aspernatur vel asperiores eos voluptatibus cupiditate vero. Placeat sunt inventore dolor atque soluta, natus vitae perferendis porro mollitia dolorum ratione voluptas?',
        photoUrl: '3D And Fantasy Girls (9).jpg'
    },
    {
        name: 'Wisdom Opoku',
        text: 'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Nostrum neque assumenda unde, alias sit eum quas, autem qui veniam architecto quis non tempore rem illo excepturi officiis a officia ipsa?Tenetur quasi dicta deserunt delectus accusamus quo, labore,',
        photoUrl: '3D Games Wallpaper 2014.jpg'
    },
    {
        name: 'Seth Okyere',
        text: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Quo perspiciatis tenetur vel ratione saepe voluptate porro sequi dolore dicta, doloremque soluta assumenda ducimus reiciendis quis vitae vero ex suscipit. Nemo.Maiores, facilis temporibus eius inventore architecto iste repellat vitae excepturi minima recusandae, eos soluta?',
        photoUrl: '8.jpg'
    },
    {
        name: 'Benjamin Nuworkpor',
        text: 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Adipisci, reprehenderit! Explicabo, aliquam repellat facere quas blanditiis, eius minima cumque voluptates omnis dolor enim quidem animi voluptatibus sequi placeat quo rem?Quos distinctio quod deleniti at laboriosam pariatur quam sint eos suscipit earum repellendus itaque vitae iusto atque maxime,',
        photoUrl: '2012_prototype_2-wallpaper-1920x1080.jpg'
    },
    {
        name: 'Sampson Asante',
        text: ' Lorem ipsum, dolor sit amet consectetur adipisicing elit. Ab provident accusantium sed, vitae quo ducimus ex dolorem beatae deleniti odit recusandae amet voluptates nisi itaque obcaecati iste facere quam doloribus?Accusantium quod perspiciatis, iste, provident aut ipsam deleniti asperiores architecto animi a earum culpa necessitatibus optio perferendis qui. Suscipit adipisci nostrum dicta sequi alias assumenda dolor molestias eum similique repudiandae?Ea excepturi sed pariatur laboriosam error incidunt tempore, consectetur, adipisci dolorum ad molestiae provident ab voluptatem est reiciendis.',
        photoUrl: '61029.jpg'
    }
]

const imgEl = document.querySelector('img')
const textEl = document.querySelector('.text')
const userNameEl = document.querySelector('.username')

let index = 0;

updateTestimonial()

function updateTestimonial(){
    const {name, text, photoUrl} = testimonialCard[index]

    imgEl.src = photoUrl

    textEl.innerText = text

    userNameEl.innerText = name

    index++;

    if(index === testimonialCard.length){
        index = 0;
    }


    setTimeout(updateTestimonial, 4000)

}