# yura-5

I want to create an amazing slide making app in Lovable. 

Core ideas/architecture:
1. All slides have locked size/aspect ratio. Should look similar at whatever zoom I look into it (no dynamic reizing weidness). PDF-style
2. Commenting functionality (overlay on top of slides). Resolution/threads
3. See all slides on left bar (iframe or similar? Idk)
4. Be able to reorder slides (via storing the slide HTML → supabase link)
5. Slide structure should be powerful but very flexible. People will eg generate competely custom animations, charts etc... But w estill want to make sure some basic things are easy to do and consistent. Eg title slides, title location, positinoning. Should ideally be fixed. Perhaps some kind of cooridnate system + 10 high level templates for how 'components' cna be poisitione,d hten components can be anything (or something of preselted?) Help me create right abstraction here 
6. Create new slide functionality in the Left slide left bar. When doing that you have option to just 'enter desription' of slide to supabase. When you do that,  lovable will be able to ready supabase later and improve on the slides. later when using the chat
7. Start off with a bunch of example slides showcasing the functionality, content etc... 
8. Setup a basic CMS in supabase. All strings should be from there
9. Document your setup throughly in setup.md. This will be later used to create reusale template from this project 
10. Each slide should aim to be very inependent from others → changing one wont change others easily to make agent easier to rason about

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cafa4b10-9824-470b-b644-375325b2cbc3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
