Description
===========

Greyboard is an HTML5 multiplayer writeboard.

License
-------

There is no license yet, so please assume the code may only be used for learning purposes and/or hosting a _private_ Greyboard server.

Installation
============

1. Install the latest version of Node.js.
2. Install the prerequisites for node-canvas:

    $ sudo apt-get install libcairo2-dev libjpeg8-dev libpango1.0-dev libgif-dev build-essential g++

3. Install modules in the Greyboard directory:

    $ cd greyboard
    $ npm install

4. Configure config.json and rooms/*/config.json with your editor of choice.
5. Start Greyboard:

    $ node app.js

Libraries used
==============

* Socket.io
* JSON2
* Tinycolor
* Underscore.js

On the server side only:
* Express web framework
* Node-canvas

On the client side only:
* JQuery
* JQuery-ui [being phased out, used only for slider]
* Twitter Bootstrap
* LAB.js [async loading]
